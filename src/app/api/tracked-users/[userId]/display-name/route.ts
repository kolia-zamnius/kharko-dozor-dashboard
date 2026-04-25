import { withAuth } from "@/app/api/_lib/with-auth";
import { updateDisplayNameSchema } from "@/api-client/tracked-users/validators";
import { requireMember } from "@/server/auth/permissions";
import { prisma } from "@/server/db/client";
import { HttpError } from "@/server/http-error";
import { log } from "@/server/logger";

type Params = { userId: string };

/**
 * `PATCH /api/tracked-users/[userId]/display-name` — update display-name overrides.
 *
 * ADMIN+ of the owning org — display names are organizational
 * metadata, not viewer-editable.
 *
 * @remarks
 * Body: `{ customName?: string | null, traitKey?: string | null }`.
 * Omitted field → leave unchanged. `string` → set (trimmed +
 * validated). `null` → clear (fall back through resolver chain).
 */
export const PATCH = withAuth<Params>(async (req, user, { userId }) => {
  const trackedUser = await prisma.trackedUser.findUnique({
    where: { id: userId },
    select: { id: true, project: { select: { organizationId: true } } },
  });

  if (!trackedUser) {
    throw new HttpError(404, "User not found");
  }

  await requireMember(user.id, trackedUser.project.organizationId, "ADMIN");

  const body = updateDisplayNameSchema.parse(await req.json());

  // Only explicitly-present fields reach Prisma — omitted fields stay untouched.
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
