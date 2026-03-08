import "server-only";

import { prisma } from "@/server/db/client";
import type { IngestEvent } from "./parse-body";

type SliceMeta = { readonly id: string; readonly startedAt: Date };

/**
 * Resolve slice metadata for every `sliceIndex` referenced by events.
 *
 * @remarks
 * One `findMany` indexed on `(sessionId, index IN (...))` is cheaper
 * than per-event lookups. The returned map is reused downstream for
 * both event linkage and aggregate recomputation.
 *
 * @param sessionId - Internal session primary key.
 * @param events - Events from the batch (empty → still returns the default slice map).
 */
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

/**
 * Bulk-insert events AND recompute per-slice aggregates in one transaction.
 *
 * @remarks
 * `createMany` is a single round-trip. Aggregate updates (`eventCount`
 * increment + `endedAt` + `duration`) are bundled into `$transaction`
 * so aggregates never desync from event rows mid-batch.
 *
 * No-op on empty batches — the session upsert already bumped
 * `endedAt` / `eventCount` if applicable.
 *
 * @param sessionId - Internal session primary key.
 * @param events - Events from the batch.
 * @param sliceMap - Output of {@link loadSliceMapForEvents}.
 */
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

/**
 * Fold events into `(sliceIndex → { count, maxTimestamp })` in one pass.
 *
 * @remarks
 * Cheaper than grouping twice (once for count, once for max).
 */
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
