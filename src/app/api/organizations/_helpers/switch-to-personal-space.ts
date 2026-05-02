import "server-only";

import type { Prisma } from "@/generated/prisma/client";

type TransactionClient = Prisma.TransactionClient;

/**
 * Flip a user's `activeOrganizationId` back to their Personal Space.
 *
 * @remarks
 * Shared transaction step for any flow that detaches a user from the
 * org they were acting as — without this rebase, the surrounding
 * transaction would fail the `User.activeOrganizationId` FK after the
 * org disappears (the schema does not declare `SetNull` for that
 * pointer). Falls back to `null` when the user somehow has no Personal
 * Space left (shouldn't happen — the sign-up event provisions one —
 * but kept defensive).
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
