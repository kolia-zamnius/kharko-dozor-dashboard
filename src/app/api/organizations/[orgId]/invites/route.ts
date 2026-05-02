import { expireStaleInvites } from "@/app/api/_lib/invite-lifecycle";
import { withAuth } from "@/app/api/_lib/with-auth";
import { INVITE_EXPIRY_DAYS } from "@/api-client/organizations/constants";
import {
  organizationInviteCreatedSchema,
  organizationInviteListSchema,
} from "@/api-client/organizations/response-schemas";
import { inviteSchema } from "@/api-client/organizations/validators";
import { resolveLocaleForUser } from "@/i18n/resolve-locale";
import { getEnabledProviders } from "@/server/auth/enabled-providers";
import { requireMember } from "@/server/auth/permissions";
import { prisma } from "@/server/db/client";
import { HttpError } from "@/server/http-error";
import { assertInviteRateLimit, bumpInviteRateLimit } from "@/server/invite-rate-limit";
import { log } from "@/server/logger";
import { sendMail } from "@/server/mailer";
import * as Sentry from "@sentry/nextjs";
import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";
import { inviteEmailHtml } from "./_helpers/invite-email";
import { refreshOrCreatePendingInvite } from "./_helpers/refresh-or-create";

type Params = { orgId: string };

/**
 * `GET /api/organizations/[orgId]/invites` — admin-side list of outstanding invites.
 *
 * OWNER-only — invite lifecycle (send, extend, revoke, change role)
 * is a governance surface; admins can't act on it so there's no value
 * in showing it to them.
 *
 * @remarks
 * Lazy expiry matches `GET /api/user/invites` — past-TTL rows are
 * filtered out and flipped to `EXPIRED` in the background via
 * {@link expireStaleInvites}.
 */
export const GET = withAuth<Params>(async (_req, user, { orgId }) => {
  await requireMember(user.id, orgId, "OWNER");

  const now = new Date();

  const invites = await prisma.invite.findMany({
    where: { organizationId: orgId, status: "PENDING" },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      email: true,
      role: true,
      expiresAt: true,
      createdAt: true,
      invitedBy: { select: { name: true, email: true } },
    },
  });

  const live: typeof invites = [];
  const expiredIds: string[] = [];
  for (const invite of invites) {
    if (invite.expiresAt < now) expiredIds.push(invite.id);
    else live.push(invite);
  }

  expireStaleInvites(expiredIds);

  return NextResponse.json(
    organizationInviteListSchema.parse(
      live.map((i) => ({
        id: i.id,
        email: i.email,
        // Defensive downgrade — `inviteSchema` rejects OWNER, but any legacy
        // OWNER rows in the wild should still render as VIEWER on the client.
        role: i.role === "OWNER" ? "VIEWER" : i.role,
        expiresAt: i.expiresAt.toISOString(),
        createdAt: i.createdAt.toISOString(),
        invitedBy: i.invitedBy,
      })),
    ),
  );
});

/**
 * `POST /api/organizations/[orgId]/invites` — send or resend an invite.
 *
 * OWNER-only.
 *
 * @remarks
 * Idempotent "refresh-or-create" via {@link refreshOrCreatePendingInvite}
 * — mirrors Notion / Linear / Slack semantics: pressing Invite on an
 * already-invited email bumps the TTL, swaps role, and re-fires the
 * email. Doubles as the "email lost in spam" recovery path.
 *
 * Email send is fire-and-forget. The invite row is already persisted,
 * so a transient SMTP failure must never block the API response — the
 * in-app list is the primary acceptance surface regardless.
 *
 * @throws {HttpError} 403 — attempting to invite into Personal Space.
 * @throws {HttpError} 409 — recipient is already a member (raised
 *   inside the helper; the admin should change their role instead).
 * @throws {HttpError} 429 — daily invite-send cap hit (per-sender
 *   rate-limit, see {@link assertInviteRateLimit}).
 */
export const POST = withAuth<Params>(async (req, user, { orgId }) => {
  await requireMember(user.id, orgId, "OWNER");

  // Sending invites requires SMTP — without it the invitee never hears
  // about the invite, so creating a dangling row is worse than refusing
  // the request. 503 because this is an instance-config issue (the
  // self-hoster didn't wire SMTP), not a permission or input problem.
  if (!getEnabledProviders().otp) {
    throw new HttpError(503, "Email sending is not configured on this instance");
  }

  // Rate-limit probe BEFORE the work so a capped admin sees the
  // right error instantly, with no DB write or SMTP dispatch on a
  // send that'll 429 anyway.
  await assertInviteRateLimit(user.id);

  const org = await prisma.organization.findUniqueOrThrow({
    where: { id: orgId },
    select: { type: true, name: true },
  });

  if (org.type === "PERSONAL") {
    throw new HttpError(403, "Cannot invite to Personal Space");
  }

  const body = inviteSchema.parse(await req.json());

  const invite = await refreshOrCreatePendingInvite({
    orgId,
    email: body.email,
    role: body.role,
    inviterId: user.id,
  });

  log.info("org:invite:create_or_refresh:ok", {
    orgId,
    inviteId: invite.id,
    email: invite.email,
    role: invite.role,
    expiresAt: invite.expiresAt.toISOString(),
    byUserId: user.id,
  });

  // Count this send against today's quota. Bumped AFTER the invite
  // row landed (and before the fire-and-forget email — we've done
  // real work at this point) so a DB failure above doesn't burn a
  // quota slot on a no-op. SMTP failures are tolerated — the invite
  // already exists in the in-app list, which is the primary
  // acceptance surface.
  await bumpInviteRateLimit(user.id);

  // Resolve recipient locale (invitee's stored preference; falls back to
  // `DEFAULT_LOCALE` when they haven't registered yet — deliberately not
  // the inviter's locale, since the invitee may not share it).
  const locale = await resolveLocaleForUser(body.email);
  const t = await getTranslations({ locale, namespace: "emailInvite" });

  // Fire-and-forget email (see JSDoc @remarks).
  sendMail({
    to: body.email,
    subject: t("subject", { orgName: org.name }),
    html: inviteEmailHtml({
      locale,
      orgName: org.name,
      inviterName: user.name ?? "Someone",
      role: body.role,
      expiryDays: INVITE_EXPIRY_DAYS,
      t,
    }),
  })
    .then(() => log.info("org:invite:email:sent", { email: body.email }))
    .catch((err: unknown) => {
      // Fire-and-forget delivery — the route already returned 200, the
      // user got their "invite sent" toast, but SMTP threw on us. The
      // catch swallows the error so it never bubbles to onRequestError,
      // hence the explicit Sentry capture: an unmonitored SMTP outage
      // would silently let invites pile up un-delivered.
      log.error("org:invite:email:delivery_failed", { err, email: body.email });
      Sentry.captureException(err, { tags: { area: "org:invite:email" }, extra: { email: body.email } });
    });

  // Always 200 — 201 would only be accurate on the create branch, and
  // the client's `apiFetch` only inspects `res.ok`. Response schema
  // also narrows `role` to `ADMIN | VIEWER`, mirroring `inviteSchema`
  // on the way in — a drift either side fails fast at the boundary.
  return NextResponse.json(
    organizationInviteCreatedSchema.parse({ id: invite.id, email: invite.email, role: invite.role }),
  );
});
