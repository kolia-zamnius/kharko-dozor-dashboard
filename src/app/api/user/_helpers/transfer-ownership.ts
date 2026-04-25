import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { log } from "@/server/logger";

type TransactionClient = Prisma.TransactionClient;

/**
 * Promote the oldest remaining ADMIN (or any remaining member) to OWNER.
 *
 * @remarks
 * Successor priority: oldest ADMIN → oldest any-role member → `null`
 * (empty org — caller decides what to do). Falls through in priority
 * order, not preference; the first non-null match wins.
 */
async function findSuccessor(tx: TransactionClient, orgId: string, excludeUserId: string) {
  return (
    (await tx.membership.findFirst({
      where: { organizationId: orgId, userId: { not: excludeUserId }, role: "ADMIN" },
      orderBy: { createdAt: "asc" },
    })) ??
    (await tx.membership.findFirst({
      where: { organizationId: orgId, userId: { not: excludeUserId } },
      orderBy: { createdAt: "asc" },
    }))
  );
}

/**
 * Hand off org ownership when the current OWNER (or creator) leaves.
 *
 * @remarks
 * Two independent steps, both opt-in based on the departing user's
 * role and relation to `createdById`:
 *   1. If the departing user was an OWNER and no other OWNER remains,
 *      promote {@link findSuccessor}. Silent no-op when the org has no
 *      successor (the caller already handles the empty-org case).
 *   2. If the departing user was the org creator, reassign
 *      `createdById` to whichever OWNER survives step 1 — the
 *      "fallback on creator leaves" contract downstream.
 *
 * Consumed by:
 *   - `DELETE /api/user` (full account deletion across all shared orgs).
 *   - `DELETE /api/organizations/[orgId]/members/[memberId]` (leave or
 *     remove flow).
 *
 * @param tx - Active Prisma transaction client.
 * @param orgId - Organization whose ownership we're handing off.
 * @param createdById - Current `Organization.createdById` value.
 * @param departingUserId - User being removed.
 * @param departingUserRole - The departing user's role — governs whether
 *   step 1 fires at all.
 */
export async function transferOrganizationOwnership(
  tx: TransactionClient,
  orgId: string,
  createdById: string,
  departingUserId: string,
  departingUserRole: string,
): Promise<void> {
  if (departingUserRole === "OWNER") {
    const hasOtherOwner = await tx.membership.findFirst({
      where: { organizationId: orgId, userId: { not: departingUserId }, role: "OWNER" },
    });

    if (!hasOtherOwner) {
      const successor = await findSuccessor(tx, orgId, departingUserId);
      if (!successor) {
        log.warn("org:ownership:transfer:no_successor", { orgId, departingUserId });
        return;
      }

      await tx.membership.update({
        where: { id: successor.id },
        data: { role: "OWNER" },
      });

      log.info("org:ownership:transfer:ok", {
        orgId,
        fromUserId: departingUserId,
        toUserId: successor.userId,
        successorPriorRole: successor.role,
      });
    }
  }

  if (createdById === departingUserId) {
    const owner = await tx.membership.findFirst({
      where: { organizationId: orgId, userId: { not: departingUserId }, role: "OWNER" },
      orderBy: { createdAt: "asc" },
    });

    if (owner) {
      await tx.organization.update({
        where: { id: orgId },
        data: { createdById: owner.userId },
      });

      log.info("org:created_by:reassign:ok", {
        orgId,
        fromUserId: departingUserId,
        toUserId: owner.userId,
      });
    }
  }
}
