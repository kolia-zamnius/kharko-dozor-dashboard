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
 * Existing membership is the one hard 409 — caller's UI should route to the
 * members modal for a role change instead.
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
