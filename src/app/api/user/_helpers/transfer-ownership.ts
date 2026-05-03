import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { log } from "@/server/logger";

type TransactionClient = Prisma.TransactionClient;

/** Priority — oldest ADMIN → oldest any-role member → `null` (empty org, caller decides). */
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
 * Two independent steps:
 *   1. Sole-OWNER leave → promote `findSuccessor` (silent no-op on empty org —
 *      the caller handles that branch).
 *   2. Creator leave → reassign `createdById` to whichever OWNER survives step
 *      1. Skipped when `createdById` is null (creator already deleted via SetNull).
 */
export async function transferOrganizationOwnership(
  tx: TransactionClient,
  orgId: string,
  createdById: string | null,
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
