import { withAuth } from "@/app/api/_lib/with-auth";
import { updateDisplayNameSchema } from "@/api-client/tracked-users/schemas";
import { requireResourceAccess } from "@/server/auth/permissions";
import { prisma } from "@/server/db/client";
import { HttpError } from "@/server/http-error";
import { log } from "@/server/logger";

type Params = { userId: string };

/**
 * Three-mode per field — omitted = leave unchanged, string = set, null =
 * clear (resolver falls through). ADMIN+ — display names are org metadata.
 */
export const PATCH = withAuth<Params>(async (req, user, { userId }) => {
  const trackedUser = await prisma.trackedUser.findUnique({
    where: { id: userId },
    select: { id: true, project: { select: { organizationId: true } } },
  });

  if (!trackedUser) {
    throw new HttpError(404, "User not found");
  }

  await requireResourceAccess(user.id, user.activeOrganizationId, trackedUser.project.organizationId, "ADMIN");

  const body = updateDisplayNameSchema.parse(await req.json());

  const data: { customName?: string | null; displayNameTraitKey?: string | null } = {};
  if (body.customName !== undefined) data.customName = body.customName;
  if (body.traitKey !== undefined) data.displayNameTraitKey = body.traitKey;

  await prisma.trackedUser.update({
    where: { id: userId },
    data,
  });

  log.info("tracked_user:display_name:update:ok", {
    trackedUserId: userId,
    orgId: trackedUser.project.organizationId,
    customName: body.customName ?? null,
    traitKey: body.traitKey ?? null,
    byUserId: user.id,
  });

  return new Response(null, { status: 204 });
});
