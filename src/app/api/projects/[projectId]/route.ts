import { withAuth } from "@/app/api/_lib/with-auth";
import { updateProjectSchema } from "@/api-client/projects/validators";
import { requireProjectMember } from "@/server/auth/permissions";
import { prisma } from "@/server/db/client";
import { log } from "@/server/logger";

type Params = { projectId: string };

/**
 * `PATCH /api/projects/[projectId]` — rename a project.
 *
 * ADMIN+ — metadata only, not key lifecycle.
 */
export const PATCH = withAuth<Params>(async (req, user, { projectId }) => {
  await requireProjectMember(user.id, projectId, "ADMIN");

  const body = updateProjectSchema.parse(await req.json());

  await prisma.project.update({
    where: { id: projectId },
    data: { name: body.name },
  });

  log.info("project:rename:ok", { projectId, name: body.name, byUserId: user.id });

  return new Response(null, { status: 204 });
});

/**
 * `DELETE /api/projects/[projectId]` — hard-delete a project.
 *
 * OWNER-only. Cascades sessions → slices → events → tracked users.
 *
 * @remarks
 * Admin flows top out at rename + key-regen — they can replace a
 * leaked key but cannot wipe history. Dataset-level destruction is
 * governance-tier.
 */
export const DELETE = withAuth<Params>(async (req, user, { projectId }) => {
  await requireProjectMember(user.id, projectId, "OWNER");

  await prisma.project.delete({ where: { id: projectId } });

  log.info("project:delete:ok", { projectId, byUserId: user.id });

  return new Response(null, { status: 204 });
});
