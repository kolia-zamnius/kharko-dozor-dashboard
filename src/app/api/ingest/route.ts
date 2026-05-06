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

/**
 * Always 204 — clients don't need an echo and smaller bodies win on mobile.
 *
 * Sequential pipeline: parse → session upsert (synthesise initial url-marker
 * on first creation) → INSERT EventBatch (gzip blob) → extract `dozor:*`
 * custom-event markers into typed `Marker` rows → fire-and-forget
 * `Project.lastUsedAt`. Each step is data-dependent.
 */
export const POST = withPublicKey(async ({ project, req }) => {
  const payload = ingestSchema.parse(
    await parseIngestBody(req).catch((err) => {
      if (isHttpError(err)) throw err;
      return null;
    }),
  );
  const { sessionId: externalId, events, metadata } = payload;

  const session = await upsertSessionAndLinkTrackedUser(project.id, externalId, events, metadata);

  if (session.wasCreated) {
    await insertInitialUrlMarker(session.id, session.startedAt, metadata);
  }

  await insertEventBatch(session.id, events);
  await extractAndInsertMarkers(session.id, events);

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
