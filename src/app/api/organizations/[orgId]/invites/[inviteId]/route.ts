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
 * Discriminated body — `{ action: "change-role", role }` or `{ action: "extend" }`.
 * Extend re-attributes `invitedById` to the acting user (matches POST resend
 * semantics — whoever pressed the button is inviter of record).
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
 * Hard-delete (not a status flip) — POST resend-or-create looks up by
 * `(email, organizationId)`; leaving REVOKED rows would force that path to
 * filter them and complicate the idempotency.
 */
export const DELETE = withAuth<Params>(async (_req, user, { orgId, inviteId }) => {
  await requireMember(user.id, orgId, "OWNER");
  await loadPendingOrgInvite(orgId, inviteId);

  await prisma.invite.delete({ where: { id: inviteId } });

  log.info("org:invite:revoke:ok", { orgId, inviteId, byUserId: user.id });

  return new Response(null, { status: 204 });
});
