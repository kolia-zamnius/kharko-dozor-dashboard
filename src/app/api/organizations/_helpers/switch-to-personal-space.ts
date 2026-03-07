import "server-only";

import type { Prisma } from "@/generated/prisma/client";

type TransactionClient = Prisma.TransactionClient;

/**
 * Flip a user's `activeOrganizationId` back to their Personal Space.
 *
 * @remarks
 * Called inside transactions that delete an org the user is currently
 * "acting as" — without this step, the org delete would error on the
 * `User.activeOrganizationId` FK (schema does not declare `SetNull`
 * for that pointer). Falls back to `null` when the user somehow has
 * no Personal Space left (shouldn't happen — the sign-up event
 * provisions one — but kept defensive).
 *
 * Consumed by:
 *   - `DELETE /api/organizations/[orgId]` (admin deletes a TEAM org).
 *   - `DELETE /api/organizations/[orgId]/members/[memberId]` (member
 *     leaves or is removed).
 *
 * @param tx - Active Prisma transaction client.
 * @param userId - User whose active-org pointer to rebase.
 */
export async function switchToPersonalSpace(tx: TransactionClient, userId: string): Promise<void> {
  const personalOrg = await tx.organization.findFirst({
    where: { type: "PERSONAL", memberships: { some: { userId } } },
    select: { id: true },
  });

  await tx.user.update({
    where: { id: userId },
    data: { activeOrganizationId: personalOrg?.id ?? null },
  });
}
