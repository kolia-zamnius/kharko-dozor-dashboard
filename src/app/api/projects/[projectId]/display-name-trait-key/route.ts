import { withAuth } from "@/app/api/_lib/with-auth";
import { updateProjectDisplayNameTraitKeySchema } from "@/api-client/projects/validators";
import { requireProjectMember } from "@/server/auth/permissions";
import { prisma } from "@/server/db/client";

type Params = { projectId: string };

/**
 * `PATCH /api/projects/[projectId]/display-name-trait-key` — project-wide default trait key.
 *
 * ADMIN+ of the owning org — project-wide config affects every user's
 * display name.
 *
 * @remarks
 * Body: `{ traitKey: string | null }`. `string` → set default.
 * `null` → clear (resolver falls through to `externalId`). Applies
 * to every tracked user in the project without a local override
 * (`customName` or per-user `displayNameTraitKey`).
 */
export const PATCH = withAuth<Params>(async (req, user, { projectId }) => {
  await requireProjectMember(user.id, projectId, "ADMIN");

  const body = updateProjectDisplayNameTraitKeySchema.parse(await req.json());

  await prisma.project.update({
    where: { id: projectId },
    data: { defaultDisplayNameTraitKey: body.traitKey },
  });

  return new Response(null, { status: 204 });
});
