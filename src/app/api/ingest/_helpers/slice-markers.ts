import "server-only";

import { prisma } from "@/server/db/client";
import type { IngestMetadata, IngestSliceMarker } from "./parse-body";

/**
 * Close previous slices and upsert new markers in one transaction.
 *
 * @remarks
 * Transaction shape:
 *   1. `updateMany` closes every previous open slice whose `index` is
 *      one less than a marker we just received — one round-trip, no
 *      row-at-a-time loop.
 *   2. One `upsert` per marker; the unique `(sessionId, index)` index
 *      handles conflict detection.
 *
 * URLs are sliced to 2048 chars to stay under DB column limits.
 * Overflow past that length is almost always tracking parameters the
 * replay viewer doesn't need.
 *
 * @param sessionId - Internal session primary key from {@link upsertSessionAndLinkTrackedUser}.
 * @param markers - Slice markers from the current ingest batch.
 */
export async function upsertSliceMarkers(sessionId: string, markers: readonly IngestSliceMarker[]): Promise<void> {
  const firstMarker = markers[0];
  if (!firstMarker) return;
  const prevIndices = [...new Set(markers.filter((m) => m.index > 0).map((m) => m.index - 1))];
  const firstMarkerTs = firstMarker.startedAt;

  await prisma.$transaction([
    ...(prevIndices.length > 0
      ? [
          prisma.slice.updateMany({
            where: { sessionId, index: { in: prevIndices }, endedAt: null },
            data: { endedAt: new Date(firstMarkerTs) },
          }),
        ]
      : []),
    ...markers.map((marker) =>
      prisma.slice.upsert({
        where: { sessionId_index: { sessionId, index: marker.index } },
        create: {
          sessionId,
          index: marker.index,
          reason: marker.reason,
          url: marker.url.slice(0, 2048),
          pathname: marker.pathname,
          viewportWidth: marker.viewportWidth,
          viewportHeight: marker.viewportHeight,
          startedAt: new Date(marker.startedAt),
        },
        update: {},
      }),
    ),
  ]);
}

/**
 * Backward-compat fallback — create a default `index: 0` slice.
 *
 * @remarks
 * For SDK builds that don't emit `sliceMarkers[]`. Events without a
 * `sliceIndex` default to slice 0 during insertion, so the replay
 * viewer still has a slice to attach them to.
 *
 * @param sessionId - Internal session primary key.
 * @param metadata - Batch metadata (source of `url` + viewport).
 * @param minTimestamp - Earliest event timestamp in the batch.
 */
export async function ensureDefaultSlice(
  sessionId: string,
  metadata: IngestMetadata,
  minTimestamp: number,
): Promise<void> {
  let defaultPathname = "/";
  try {
    defaultPathname = new URL(metadata?.url ?? "http://x").pathname;
  } catch {
    /* keep default */
  }

  await prisma.slice.upsert({
    where: { sessionId_index: { sessionId, index: 0 } },
    create: {
      sessionId,
      index: 0,
      reason: "init",
      url: (metadata?.url ?? "").slice(0, 2048),
      pathname: defaultPathname,
      viewportWidth: metadata?.screenWidth,
      viewportHeight: metadata?.screenHeight,
      startedAt: new Date(minTimestamp),
    },
    update: {},
  });
}
