import { withAuth } from "@/app/api/_lib/with-auth";
import { switchToPersonalSpace } from "@/app/api/organizations/_helpers/switch-to-personal-space";
import { orgAvatarUrl } from "@/lib/avatar";
import { updateOrgSchema } from "@/api-client/organizations/validators";
import { requireMember } from "@/server/auth/permissions";
import { prisma } from "@/server/db/client";
import { HttpError } from "@/server/http-error";
import { log } from "@/server/logger";

type Params = { orgId: string };

/**
 * `PATCH /api/organizations/[orgId]` — edit org name and/or avatar.
 *
 * @remarks
 * ADMIN+ — metadata change affects every member's view, but OWNER is
 * reserved for destructive ops (delete, role changes, key lifecycle).
 * `regenerateAvatar: true` rolls the DiceBear seed to a new UUID.
 */
export const PATCH = withAuth<Params>(async (req, user, { orgId }) => {
  await requireMember(user.id, orgId, "ADMIN");

  const body = updateOrgSchema.parse(await req.json());

  const data: { name?: string; image?: string } = {};
  if (body.name) data.name = body.name;
  if (body.regenerateAvatar) data.image = orgAvatarUrl(crypto.randomUUID());

  if (Object.keys(data).length === 0) {
    return new Response(null, { status: 204 });
  }

  await prisma.organization.update({ where: { id: orgId }, data });

  log.info("org:update:ok", {
    orgId,
    fields: Object.keys(data).join(","),
    byUserId: user.id,
  });

  return new Response(null, { status: 204 });
});

/**
 * `DELETE /api/organizations/[orgId]` — hard-delete a TEAM organization.
 *
 * OWNER-only. Destructive.
 *
 * @remarks
 * Personal Space is protected — deleting it would orphan the account
 * with no default context to sign in to.
 *
 * Transaction steps:
 *   1. Users "acting as" this org are flipped back to Personal Space
 *      via {@link switchToPersonalSpace} (schema doesn't declare
 *      `onDelete: SetNull` on that pointer).
 *   2. Invites scoped to the org are wiped (about to reference a
 *      non-existent org).
 *   3. The org is deleted; Prisma cascades projects → sessions →
 *      slices → events → tracked users.
 *
 * @throws {HttpError} 403 — attempting to delete a Personal Space.
 */
export const DELETE = withAuth<Params>(async (req, user, { orgId }) => {
  await requireMember(user.id, orgId, "OWNER");

  const org = await prisma.organization.findUniqueOrThrow({
    where: { id: orgId },
    select: { type: true },
  });

  if (org.type === "PERSONAL") {
    throw new HttpError(403, "Cannot delete Personal Space");
  }

  const summary = await prisma.$transaction(async (tx) => {
    const affectedUsers = await tx.user.findMany({
      where: { activeOrganizationId: orgId },
      select: { id: true },
    });

    await Promise.all(affectedUsers.map((u) => switchToPersonalSpace(tx, u.id)));

    const invitesDeleted = await tx.invite.deleteMany({ where: { organizationId: orgId } });
    await tx.organization.delete({ where: { id: orgId } });

    return { affectedUsers: affectedUsers.length, invitesDeleted: invitesDeleted.count };
  });

  log.info("org:delete:ok", {
    orgId,
    byUserId: user.id,
    affectedUsers: summary.affectedUsers,
    invitesDeleted: summary.invitesDeleted,
  });

  return new Response(null, { status: 204 });
});
