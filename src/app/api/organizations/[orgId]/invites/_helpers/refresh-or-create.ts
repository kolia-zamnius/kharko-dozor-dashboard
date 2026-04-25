import "server-only";

import type { Invite, Role } from "@/generated/prisma/client";
import { INVITE_EXPIRY_DAYS } from "@/api-client/organizations/constants";
import { ONE_DAY_MS } from "@/lib/time";
import { prisma } from "@/server/db/client";
import { HttpError } from "@/server/http-error";
import { log } from "@/server/logger";

type Params = {
  orgId: string;
  email: string;
  role: Role;
  inviterId: string;
};

/**
 * Refresh the recipient's existing PENDING invite OR create a fresh one.
 *
 * @remarks
 * Idempotent "resend-or-create" semantics — pressing Invite on an
 * already-invited email bumps `expiresAt`, allows the role to change,
 * and re-attributes `invitedById` to whoever just pressed the button.
 * Mirrors Notion / Linear / Slack product behaviour and doubles as the
 * "email got lost in spam" recovery path.
 *
 * Existing membership is the one hard block — you can't re-invite a
 * current member; the caller's UI should route them to the members
 * modal for a role change.
 *
 * @throws {HttpError} 409 — recipient is already a member of the org.
 */
export async function refreshOrCreatePendingInvite({ orgId, email, role, inviterId }: Params): Promise<Invite> {
  const [existingMembership, existingPending] = await Promise.all([
    prisma.membership.findFirst({
      where: { organizationId: orgId, user: { email } },
    }),
    prisma.invite.findFirst({
      where: { email, organizationId: orgId, status: "PENDING" },
    }),
  ]);

  if (existingMembership) {
    throw new HttpError(409, "User is already a member");
  }

  const expiresAt = new Date(Date.now() + INVITE_EXPIRY_DAYS * ONE_DAY_MS);

  if (existingPending) {
    const refreshed = await prisma.invite.update({
      where: { id: existingPending.id },
      data: { role, expiresAt, invitedById: inviterId },
    });
    log.debug("org:invite:refresh:ok", {
      orgId,
      inviteId: refreshed.id,
      email,
      fromRole: existingPending.role,
      toRole: role,
    });
    return refreshed;
  }

  const created = await prisma.invite.create({
    data: {
      email,
      role,
      status: "PENDING",
      expiresAt,
      organizationId: orgId,
      invitedById: inviterId,
    },
  });
  log.debug("org:invite:create:ok", { orgId, inviteId: created.id, email, role });
  return created;
}
