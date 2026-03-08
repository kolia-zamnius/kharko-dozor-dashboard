import { corsPreflightResponse } from "@/app/api/_lib/cors";
import { withPublicKey } from "@/app/api/_lib/with-public-key";
import { prisma } from "@/server/db/client";
import { z } from "zod";

const cancelSchema = z.object({
  sessionId: z.uuid(),
});

export const OPTIONS = corsPreflightResponse;

/**
 * `POST /api/sessions/cancel` — SDK `stop()` teardown path.
 *
 * Public-key endpoint — authenticated via {@link withPublicKey}.
 *
 * @remarks
 * Called when a session should be discarded rather than persisted
 * (dev recordings, tests, user-requested cancels). Hard-deletes the
 * session row (cascades slices + events) and no-ops quietly when no
 * matching session exists — cancellation can race with the first
 * batch arriving.
 *
 * `(projectId, externalId)` scoping prevents a key for project A
 * from deleting a session that belongs to project B.
 */
export const POST = withPublicKey(async ({ project, req }) => {
  const { sessionId: externalId } = cancelSchema.parse(await req.json().catch(() => null));

  const session = await prisma.session.findUnique({
    where: { projectId_externalId: { projectId: project.id, externalId } },
    select: { id: true },
  });

  if (!session) {
    // Race: cancel arrived before the first ingest batch created the row. Quiet no-op.
    return new Response(null, { status: 204 });
  }

  await prisma.session.delete({ where: { id: session.id } });

  return new Response(null, { status: 204 });
});
