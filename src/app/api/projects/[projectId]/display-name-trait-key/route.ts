import { withAuth } from "@/app/api/_lib/with-auth";
import { updateProjectDisplayNameTraitKeySchema } from "@/api-client/projects/schemas";
import { requireProjectMember } from "@/server/auth/permissions";
import { prisma } from "@/server/db/client";
import { log } from "@/server/logger";

type Params = { projectId: string };

/**
 * `null` → resolver falls through to `externalId`. Affects every tracked user
 * in the project without a local `customName` or per-user `displayNameTraitKey`.
 */
export const PATCH = withAuth<Params>(async (req, user, { projectId }) => {
  await requireProjectMember(user.id, projectId, "ADMIN");

  const body = updateProjectDisplayNameTraitKeySchema.parse(await req.json());

  await prisma.project.update({
    where: { id: projectId },
    data: { defaultDisplayNameTraitKey: body.traitKey },
  });

  log.info("project:display_name_trait_key:update:ok", {
    projectId,
    traitKey: body.traitKey ?? null,
    byUserId: user.id,
  });

  return new Response(null, { status: 204 });
});
