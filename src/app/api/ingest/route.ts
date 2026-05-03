import { corsPreflightResponse } from "@/app/api/_lib/cors";
import { withPublicKey } from "@/app/api/_lib/with-public-key";
import { prisma } from "@/server/db/client";
import { isHttpError } from "@/server/http-error";
import { log } from "@/server/logger";

import { insertEventsAndUpdateAggregates, loadSliceMapForEvents } from "./_helpers/events";
import { ingestSchema, parseIngestBody } from "./_helpers/parse-body";
import { upsertSessionAndLinkTrackedUser } from "./_helpers/session-upsert";
import { ensureDefaultSlice, upsertSliceMarkers } from "./_helpers/slice-markers";

export const OPTIONS = corsPreflightResponse;

/**
 * Always 204 — clients don't need an echo and smaller bodies win on mobile.
 *
 * Sequential pipeline (each step reads rows the previous wrote): parse →
 * session upsert → slice markers (or `ensureDefaultSlice` fallback for
 * pre-marker SDK builds) → bulk events with per-slice aggregates → f-and-f
 * `Project.lastUsedAt`. Steps are data-dependent so parallelisation wouldn't help.
 */
export const POST = withPublicKey(async ({ project, req }) => {
  const payload = ingestSchema.parse(
    await parseIngestBody(req).catch((err) => {
      // Bubble size-cap 413s; collapse only malformed-body to null so Zod surfaces per-field 422.
      if (isHttpError(err)) throw err;
      return null;
    }),
  );
  const { sessionId: externalId, events, metadata, sliceMarkers } = payload;

  const session = await upsertSessionAndLinkTrackedUser(project.id, externalId, events, metadata);

  if (sliceMarkers && sliceMarkers.length > 0) {
    await upsertSliceMarkers(session.id, sliceMarkers);
  } else {
    const minTimestamp = events.length > 0 ? Math.min(...events.map((e) => e.timestamp)) : Date.now();
    await ensureDefaultSlice(session.id, metadata, minTimestamp);
  }

  const sliceMap = await loadSliceMapForEvents(session.id, events);
  await insertEventsAndUpdateAggregates(session.id, events, sliceMap);

  log.info("ingest:batch:received", {
    projectId: project.id,
    sessionId: session.id,
    externalId,
    eventCount: events.length,
    sliceCount: sliceMarkers?.length ?? 1,
    hasIdentity: Boolean(metadata?.userIdentity),
  });

  // Fire-and-forget — a slow/failed update must never break ingestion.
  prisma.project.update({ where: { id: project.id }, data: { lastUsedAt: new Date() } }).catch(() => {});

  return new Response(null, { status: 204 });
});
