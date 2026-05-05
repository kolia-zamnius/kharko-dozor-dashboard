import "server-only";

import { prisma } from "@/server/db/client";
import type { IngestMetadata, IngestSliceMarker } from "./parse-body";

/**
 * Upsert each marker; URLs sliced to 2048 chars (overflow is almost always
 * tracking params).
 *
 * Previous slices are intentionally NOT closed here. `endedAt` is owned by
 * `insertEventsAndUpdateAggregates`, which sets it from the slice's last
 * event timestamp. Closing on the next marker's `startedAt` would absorb
 * the idle gap into the previous slice's duration.
 */
export async function upsertSliceMarkers(sessionId: string, markers: readonly IngestSliceMarker[]): Promise<void> {
  if (markers.length === 0) return;

  await prisma.$transaction(
    markers.map((marker) =>
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
  );
}

/** Back-compat — pre-marker SDK builds. Events without `sliceIndex` default to 0 during insert. */
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
