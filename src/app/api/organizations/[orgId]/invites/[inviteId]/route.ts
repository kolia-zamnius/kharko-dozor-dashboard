import { loadPendingOrgInvite } from "@/app/api/_lib/invite-lifecycle";
import { withAuth } from "@/app/api/_lib/with-auth";
import { INVITE_EXPIRY_DAYS } from "@/api-client/organizations/constants";
import { updateInviteSchema } from "@/api-client/organizations/validators";
import { ONE_DAY_MS } from "@/lib/time";
import { requireMember } from "@/server/auth/permissions";
import { prisma } from "@/server/db/client";
import { log } from "@/server/logger";

type Params = { orgId: string; inviteId: string };

/**
 * `PATCH /api/organizations/[orgId]/invites/[inviteId]` — admin-side invite edit.
 *
 * OWNER-only.
 *
 * @remarks
 * Discriminated body:
 *   - `{ action: "change-role", role }` — update role in place.
 *   - `{ action: "extend" }` — reset TTL and re-attribute
 *     `invitedById` to the acting user (matches the `POST` resend
 *     semantic: whoever pressed the button is the inviter of record).
 *
 * {@link loadPendingOrgInvite} guards against cross-org mutation and
 * non-PENDING rows.
 */
export const PATCH = withAuth<Params>(async (req, user, { orgId, inviteId }) => {
  await requireMember(user.id, orgId, "OWNER");
  await loadPendingOrgInvite(orgId, inviteId);

  const body = updateInviteSchema.parse(await req.json());

  if (body.action === "change-role") {
    await prisma.invite.update({
      where: { id: inviteId },
      data: { role: body.role },
    });
    log.info("org:invite:role_change:ok", { orgId, inviteId, toRole: body.role, byUserId: user.id });
  } else {
    await prisma.invite.update({
      where: { id: inviteId },
      data: {
        expiresAt: new Date(Date.now() + INVITE_EXPIRY_DAYS * ONE_DAY_MS),
        invitedById: user.id,
      },
    });
    log.info("org:invite:extend:ok", { orgId, inviteId, expiryDays: INVITE_EXPIRY_DAYS, byUserId: user.id });
  }

  return new Response(null, { status: 204 });
});

/**
 * `DELETE /api/organizations/[orgId]/invites/[inviteId]` — revoke a pending invite.
 *
 * OWNER-only.
 *
 * @remarks
 * Hard-delete, not a status flip. The `POST` "resend-or-create" path
 * looks up existing PENDING rows by `(email, organizationId)` —
 * leaving a REVOKED row would force that path to filter revoked
 * statuses too, complicating the idempotent-create semantics.
 */
export const DELETE = withAuth<Params>(async (_req, user, { orgId, inviteId }) => {
  await requireMember(user.id, orgId, "OWNER");
  await loadPendingOrgInvite(orgId, inviteId);

  await prisma.invite.delete({ where: { id: inviteId } });

  log.info("org:invite:revoke:ok", { orgId, inviteId, byUserId: user.id });

  return new Response(null, { status: 204 });
});
