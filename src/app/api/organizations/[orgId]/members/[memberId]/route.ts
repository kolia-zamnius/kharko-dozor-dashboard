import { withAuth } from "@/app/api/_lib/with-auth";
import { switchToPersonalSpace } from "@/app/api/organizations/_helpers/switch-to-personal-space";
import { transferOrganizationOwnership } from "@/app/api/user/_helpers/transfer-ownership";
import { requireMember } from "@/server/auth/permissions";
import { prisma } from "@/server/db/client";
import { HttpError } from "@/server/http-error";
import { log } from "@/server/logger";
import { z } from "zod";

type Params = { orgId: string; memberId: string };

const updateRoleSchema = z.object({
  role: z.enum(["OWNER", "ADMIN", "VIEWER"], { message: "Invalid role" }),
});

/**
 * `PATCH /api/organizations/[orgId]/members/[memberId]` — change a member's role.
 *
 * OWNER-only — role changes are governance; admins edit metadata
 * only.
 */
export const PATCH = withAuth<Params>(async (req, user, { orgId, memberId }) => {
  await requireMember(user.id, orgId, "OWNER");

  const target = await prisma.membership.findUnique({
    where: { id: memberId, organizationId: orgId },
  });

  if (!target) {
    throw new HttpError(404, "Member not found");
  }

  const body = updateRoleSchema.parse(await req.json());

  await prisma.membership.update({
    where: { id: memberId },
    data: { role: body.role },
  });

  log.info("org:member:role_change:ok", {
    orgId,
    memberId,
    targetUserId: target.userId,
    fromRole: target.role,
    toRole: body.role,
    byUserId: user.id,
  });

  return new Response(null, { status: 204 });
});

/**
 * `DELETE /api/organizations/[orgId]/members/[memberId]` — remove or self-leave.
 *
 * @remarks
 * Two shapes depending on `isSelf`:
 *   - Self-leave — any member (including a sole OWNER, which triggers
 *     {@link transferOrganizationOwnership} → next-oldest ADMIN →
 *     fallback to any remaining member).
 *   - Remove other — OWNER-only.
 *
 * Also flips the departing user's active-org pointer back to Personal
 * Space if it happened to point here.
 *
 * @throws {HttpError} 403 — leaving Personal Space, or non-owner trying to remove other.
 * @throws {HttpError} 404 — member not found in this org.
 * @throws {HttpError} 409 — leaving as the only member (product answer: delete the org).
 */
export const DELETE = withAuth<Params>(async (req, user, { orgId, memberId }) => {
  const myMembership = await requireMember(user.id, orgId, "VIEWER");

  const org = await prisma.organization.findUniqueOrThrow({
    where: { id: orgId },
    select: { type: true, createdById: true },
  });

  if (org.type === "PERSONAL") {
    throw new HttpError(403, "Cannot leave Personal Space");
  }

  const target = await prisma.membership.findUnique({
    where: { id: memberId, organizationId: orgId },
    select: { id: true, userId: true, role: true },
  });

  if (!target) {
    throw new HttpError(404, "Member not found");
  }

  const isSelf = target.userId === user.id;

  if (!isSelf && myMembership.role !== "OWNER") {
    throw new HttpError(403, "Only owners can remove members");
  }

  try {
    await prisma.$transaction(async (tx) => {
      if (target.role === "OWNER") {
        const otherOwnerCount = await tx.membership.count({
          where: { organizationId: orgId, role: "OWNER", userId: { not: target.userId } },
        });

        if (otherOwnerCount === 0) {
          const otherMemberCount = await tx.membership.count({
            where: { organizationId: orgId, userId: { not: target.userId } },
          });

          if (otherMemberCount === 0) {
            throw new Error("LAST_MEMBER");
          }

          await transferOrganizationOwnership(tx, orgId, org.createdById, target.userId, target.role);
        }
      }

      await tx.membership.delete({ where: { id: memberId } });

      const removedUser = await tx.user.findUnique({
        where: { id: target.userId },
        select: { activeOrganizationId: true },
      });

      if (removedUser?.activeOrganizationId === orgId) {
        await switchToPersonalSpace(tx, target.userId);
      }
    });
  } catch (err) {
    if (err instanceof Error && err.message === "LAST_MEMBER") {
      log.warn("org:member:leave:blocked_last_member", { orgId, byUserId: user.id });
      throw new HttpError(409, "Cannot leave — you are the only member. Delete the organization instead.");
    }
    throw err;
  }

  log.info(isSelf ? "org:member:leave:ok" : "org:member:remove:ok", {
    orgId,
    memberId,
    targetUserId: target.userId,
    role: target.role,
    byUserId: user.id,
  });

  return new Response(null, { status: 204 });
});
