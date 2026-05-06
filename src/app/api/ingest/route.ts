import { corsPreflightResponse } from "@/app/api/_lib/cors";
import { withPublicKey } from "@/app/api/_lib/with-public-key";
import { prisma } from "@/server/db/client";
import { isHttpError } from "@/server/http-error";
import { log } from "@/server/logger";

import { insertEventBatch } from "./_helpers/event-batch";
import { extractAndInsertMarkers, insertInitialUrlMarker } from "./_helpers/markers";
import { ingestSchema, parseIngestBody } from "./_helpers/parse-body";
import { upsertSessionAndLinkTrackedUser } from "./_helpers/session-upsert";

export const OPTIONS = corsPreflightResponse;

// Generous over Prisma's 5s default — gzipping a max-sized 500-event batch +
// the four serial DB writes can easily clear that on cold Neon connections.
const INGEST_TX_TIMEOUT_MS = 15_000;

/**
 * Always 204 — clients don't need an echo and smaller bodies win on mobile.
 *
 * Single transaction so a failure in markers extraction never leaves an
 * EventBatch row without its corresponding `dozor:*` markers (or vice versa).
 * Pipeline: parse → session upsert (race-safe `GREATEST`/`LEAST` on retries)
 * → seed initial url-marker on first creation → INSERT EventBatch (gzip
 * blob) → extract custom-event markers. Fire-and-forget `Project.lastUsedAt`
 * lives outside the tx so a slow project-meta write can't break ingestion.
 */
export const POST = withPublicKey(async ({ project, req }) => {
  const payload = ingestSchema.parse(
    await parseIngestBody(req).catch((err) => {
      if (isHttpError(err)) throw err;
      return null;
    }),
  );
  const { sessionId: externalId, events, metadata } = payload;

  const session = await prisma.$transaction(
    async (tx) => {
      const upserted = await upsertSessionAndLinkTrackedUser(tx, project.id, externalId, events, metadata);

      if (upserted.wasCreated) {
        await insertInitialUrlMarker(tx, upserted.id, upserted.startedAt, metadata);
      }

      await insertEventBatch(tx, upserted.id, events);
      await extractAndInsertMarkers(tx, upserted.id, events);

      return upserted;
    },
    { timeout: INGEST_TX_TIMEOUT_MS },
  );

  log.info("ingest:batch:received", {
    projectId: project.id,
    sessionId: session.id,
    externalId,
    eventCount: events.length,
    hasIdentity: Boolean(metadata?.userIdentity),
  });

  // Fire-and-forget — a slow/failed update must never break ingestion.
  prisma.project.update({ where: { id: project.id }, data: { lastUsedAt: new Date() } }).catch(() => {});

  return new Response(null, { status: 204 });
});
