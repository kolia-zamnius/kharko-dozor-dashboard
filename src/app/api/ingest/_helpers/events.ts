import "server-only";

import { prisma } from "@/server/db/client";
import type { IngestEvent } from "./parse-body";

type SliceMeta = { readonly id: string; readonly startedAt: Date };

/** Single `findMany` on `(sessionId, index IN ...)` — reused for both event linkage and aggregate recompute. */
export async function loadSliceMapForEvents(
  sessionId: string,
  events: readonly IngestEvent[],
): Promise<ReadonlyMap<number, SliceMeta>> {
  const indices = events.length > 0 ? [...new Set(events.map((e) => e.sliceIndex ?? 0))] : [0];

  const rows = await prisma.slice.findMany({
    where: { sessionId, index: { in: indices } },
    select: { id: true, index: true, startedAt: true },
  });

  return new Map(rows.map((r) => [r.index, { id: r.id, startedAt: r.startedAt }]));
}

/** `$transaction` bundles `createMany` + per-slice aggregate updates so aggregates never desync mid-batch. */
export async function insertEventsAndUpdateAggregates(
  sessionId: string,
  events: readonly IngestEvent[],
  sliceMap: ReadonlyMap<number, SliceMeta>,
): Promise<void> {
  if (events.length === 0) return;

  await prisma.event.createMany({
    data: events.map((e) => ({
      sessionId,
      sliceId: sliceMap.get(e.sliceIndex ?? 0)?.id ?? null,
      sliceIndex: e.sliceIndex ?? 0,
      type: e.type,
      timestamp: BigInt(e.timestamp),
      data: e.data as object,
    })),
  });

  const aggregates = buildSliceAggregates(events);
  const sliceUpdates = [...aggregates.entries()].flatMap(([index, agg]) => {
    const slice = sliceMap.get(index);
    if (!slice) return [];
    const endedAt = new Date(agg.maxTimestamp);
    const duration = Math.max(0, Math.round((endedAt.getTime() - slice.startedAt.getTime()) / 1000));
    return [
      prisma.slice.update({
        where: { id: slice.id },
        data: { eventCount: { increment: agg.count }, endedAt, duration },
      }),
    ];
  });

  if (sliceUpdates.length > 0) {
    await prisma.$transaction(sliceUpdates);
  }
}

/** Single-pass fold — cheaper than grouping twice (once for count, once for max). */
function buildSliceAggregates(events: readonly IngestEvent[]): Map<number, { count: number; maxTimestamp: number }> {
  const byIndex = new Map<number, { count: number; maxTimestamp: number }>();
  for (const e of events) {
    const idx = e.sliceIndex ?? 0;
    const agg = byIndex.get(idx);
    if (agg) {
      agg.count += 1;
      if (e.timestamp > agg.maxTimestamp) agg.maxTimestamp = e.timestamp;
    } else {
      byIndex.set(idx, { count: 1, maxTimestamp: e.timestamp });
    }
  }
  return byIndex;
}
