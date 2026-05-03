import "server-only";

import type { Prisma } from "@/generated/prisma/client";

type TransactionClient = Prisma.TransactionClient;

/**
 * Without this rebase the surrounding transaction would fail the
 * `User.activeOrganizationId` FK after the org disappears — schema doesn't
 * declare `SetNull` for that pointer. Falls back to `null` if the user has no
 * Personal Space (shouldn't happen — sign-up provisions one — defensive).
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
