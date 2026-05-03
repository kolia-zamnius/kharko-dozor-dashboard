import "server-only";

import { prisma } from "@/server/db/client";
import type { IngestMetadata, IngestSliceMarker } from "./parse-body";

/**
 * One-tx close-then-upsert. URLs sliced to 2048 chars (overflow is almost
 * always tracking params).
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
