import { corsPreflightResponse } from "@/app/api/_lib/cors";
import { withPublicKey } from "@/app/api/_lib/with-public-key";
import { prisma } from "@/server/db/client";
import { log } from "@/server/logger";
import { z } from "zod";

const cancelSchema = z.object({
  sessionId: z.uuid(),
});

export const OPTIONS = corsPreflightResponse;

/**
 * Hard-delete (cascades event-batches + markers). 204 no-op on miss — cancel can race
 * with the first ingest batch arriving (treating it as 404 would spam Sentry).
 * `(projectId, externalId)` scoping prevents a key for project A from deleting
 * project B's session.
 */
export const POST = withPublicKey(async ({ project, req }) => {
  const { sessionId: externalId } = cancelSchema.parse(await req.json().catch(() => null));

  const session = await prisma.session.findUnique({
    where: { projectId_externalId: { projectId: project.id, externalId } },
    select: { id: true },
  });

  if (!session) {
    // Cancel arrived before the first ingest batch — quiet no-op.
    log.debug("session:cancel:noop_race", { projectId: project.id, externalId });
    return new Response(null, { status: 204 });
  }

  await prisma.session.delete({ where: { id: session.id } });

  log.info("session:cancel:ok", { sessionId: session.id, projectId: project.id, externalId });

  return new Response(null, { status: 204 });
});
