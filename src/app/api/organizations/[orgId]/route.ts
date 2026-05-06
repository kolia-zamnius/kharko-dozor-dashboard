import { withAuth } from "@/app/api/_lib/with-auth";
import { switchToPersonalSpace } from "@/app/api/organizations/_helpers/switch-to-personal-space";
import { orgAvatarUrl } from "@/lib/avatar";
import { updateOrgSchema } from "@/api-client/organizations/validators";
import { requireMember } from "@/server/auth/permissions";
import { prisma } from "@/server/db/client";
import { HttpError } from "@/server/http-error";
import { log } from "@/server/logger";

type Params = { orgId: string };

/** ADMIN+ — OWNER stays reserved for destructive ops. `regenerateAvatar: true` rolls the DiceBear seed. */
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
 * OWNER-only. Personal Space protected — deleting it orphans the account with
 * no default context. Tx: rebase active-org pointers (schema lacks `SetNull`),
 * wipe invites, delete org (cascades projects → sessions → event batches +
 * markers → tracked users).
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
