import { corsPreflightResponse } from "@/app/api/_lib/cors";
import { withPublicKey } from "@/app/api/_lib/with-public-key";
import { prisma } from "@/server/db/client";

import { insertEventsAndUpdateAggregates, loadSliceMapForEvents } from "./_helpers/events";
import { ingestSchema, parseIngestBody } from "./_helpers/parse-body";
import { upsertSessionAndLinkTrackedUser } from "./_helpers/session-upsert";
import { ensureDefaultSlice, upsertSliceMarkers } from "./_helpers/slice-markers";

export const OPTIONS = corsPreflightResponse;

/**
 * `POST /api/ingest` — rrweb event-batch ingestion from the `@kharko/dozor` SDK.
 *
 * Public-key endpoint via {@link withPublicKey}. Always returns
 * `204 No Content` on success — clients don't need an echo of what
 * they sent, and the smaller body wins on mobile networks.
 *
 * @remarks
 * Sequential pipeline, each step reads rows the previous one wrote:
 *   1. {@link parseIngestBody} — gzip-aware read + zod validate.
 *   2. {@link upsertSessionAndLinkTrackedUser} — idempotent session
 *      upsert + link identified tracked user.
 *   3. {@link upsertSliceMarkers} OR {@link ensureDefaultSlice} —
 *      close previous slices and upsert new markers; fall back to a
 *      single `index: 0` slice for SDK builds without markers.
 *   4. {@link loadSliceMapForEvents} + {@link insertEventsAndUpdateAggregates}
 *      — bulk-insert events, update per-slice aggregates in one txn.
 *   5. Fire-and-forget `Project.lastUsedAt` bump.
 *
 * Parallelisation isn't worth it — steps are data-dependent, and
 * batches arrive every few seconds per client so hot-path throughput
 * is already bounded by DB write latency, not helper sequencing.
 */
export const POST = withPublicKey(async ({ project, req }) => {
  const payload = ingestSchema.parse(await parseIngestBody(req).catch(() => null));
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

  // Fire-and-forget lastUsedAt — a slow or failed update here must
  // never break ingestion.
  prisma.project.update({ where: { id: project.id }, data: { lastUsedAt: new Date() } }).catch(() => {});

  return new Response(null, { status: 204 });
});
