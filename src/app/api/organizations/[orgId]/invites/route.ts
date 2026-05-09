import { expireStaleInvites } from "@/app/api/_lib/invite-lifecycle";
import { withAuth } from "@/app/api/_lib/with-auth";
import { INVITE_EXPIRY_DAYS } from "@/api-client/organizations/constants";
import { organizationInviteCreatedSchema, organizationInviteListSchema } from "@/api-client/organizations/schemas";
import { inviteSchema } from "@/api-client/organizations/schemas";
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
 * OWNER-only — invite lifecycle is governance, ADMIN can't act on it.
 * Lazy expiry on read (matches `GET /api/user/invites`).
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
        // Defensive — `inviteSchema` rejects OWNER, but legacy OWNER rows in the wild render as VIEWER.
        role: i.role === "OWNER" ? "VIEWER" : i.role,
        expiresAt: i.expiresAt.toISOString(),
        createdAt: i.createdAt.toISOString(),
        invitedBy: i.invitedBy,
      })),
    ),
  );
});

/**
 * Idempotent refresh-or-create (Notion/Linear/Slack semantics) — re-pressing
 * Invite bumps TTL, swaps role, re-fires the email; doubles as the "lost in
 * spam" recovery path. Email is fire-and-forget — the row is already persisted
 * and the in-app list is the primary acceptance surface.
 */
export const POST = withAuth<Params>(async (req, user, { orgId }) => {
  await requireMember(user.id, orgId, "OWNER");

  // 503 — instance-config issue (self-hoster didn't wire SMTP), not a permission/input problem.
  // A dangling invite row with no email is worse than refusing.
  if (!getEnabledProviders().otp) {
    throw new HttpError(503, "Email sending is not configured on this instance");
  }

  // Probe before the work — capped admin sees 429 instantly, no wasted DB write or SMTP.
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

  // Bumped AFTER the row landed so a DB failure above doesn't burn a quota slot on a no-op.
  await bumpInviteRateLimit(user.id);

  // Invitee's stored locale (NOT inviter's — they may not share one). Falls
  // back to `DEFAULT_LOCALE` for unregistered recipients.
  const locale = await resolveLocaleForUser(body.email);
  const t = await getTranslations({ locale, namespace: "emailInvite" });

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
      // Route already returned 200, catch swallows so it never bubbles to
      // onRequestError — explicit Sentry call so an SMTP outage doesn't pile
      // up un-delivered invites silently.
      log.error("org:invite:email:delivery_failed", { err, email: body.email });
      Sentry.captureException(err, { tags: { area: "org:invite:email" }, extra: { email: body.email } });
    });

  // 200 not 201 — 201 would only be right on create, and `apiFetch` only inspects `res.ok`.
  return NextResponse.json(
    organizationInviteCreatedSchema.parse({ id: invite.id, email: invite.email, role: invite.role }),
  );
});
