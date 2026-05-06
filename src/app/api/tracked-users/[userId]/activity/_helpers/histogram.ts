import "server-only";

import { MAX_TOP_PAGES_PER_BUCKET } from "@/app/api/_lib/constants";
import { Prisma } from "@/generated/prisma/client";
import type { ActivityBucket } from "@/api-client/tracked-users/types";
import { prisma } from "@/server/db/client";

type BucketRow = { bucket: Date; pathname: string | null; n: bigint };

// Per-batch attribution — every event in a batch is assigned to the bucket
// where the batch *started* (`firstTimestamp`). Exact per-event timestamps live
// inside the gzip blob and would cost a JSON-parse-per-batch to honour, so the
// histogram trades sub-batch precision (≤ 60s, our flush window) for cheap SQL.
// Pathname per bucket = most recent url-marker timestamp ≤ batch start.
export async function computeActivityHistogram(
  trackedUserId: string,
  from: Date,
  to: Date,
  pgInterval: string,
): Promise<ActivityBucket[]> {
  const fromMs = BigInt(from.getTime());
  const toMs = BigInt(to.getTime());
  const intervalFragment = Prisma.raw(`'${pgInterval}'::interval`);

  const rows = await prisma.$queryRaw<BucketRow[]>`
    WITH batch_buckets AS (
      SELECT
        date_bin(
          ${intervalFragment},
          to_timestamp(eb."firstTimestamp"::double precision / 1000),
          timestamp '2020-01-01'
        ) AS bucket,
        eb."sessionId",
        eb."firstTimestamp",
        eb."eventCount"
      FROM "EventBatch" eb
      JOIN "Session" s ON s.id = eb."sessionId"
      WHERE s."trackedUserId" = ${trackedUserId}
        AND eb."firstTimestamp" >= ${fromMs}
        AND eb."firstTimestamp" <  ${toMs}
    ),
    last_url_per_batch AS (
      SELECT
        bb.bucket,
        bb."sessionId",
        bb."firstTimestamp",
        bb."eventCount",
        (
          SELECT m.data->>'pathname'
          FROM "Marker" m
          WHERE m."sessionId" = bb."sessionId"
            AND m.kind = 'url'
            AND m.timestamp <= bb."firstTimestamp"
          ORDER BY m.timestamp DESC
          LIMIT 1
        ) AS pathname
      FROM batch_buckets bb
    )
    SELECT bucket, pathname, SUM("eventCount")::bigint AS n
    FROM last_url_per_batch
    GROUP BY bucket, pathname
    ORDER BY bucket ASC
  `;

  return assembleBuckets(rows);
}

function assembleBuckets(rows: readonly BucketRow[]): ActivityBucket[] {
  const bucketMap = new Map<number, Map<string, number>>();
  for (const row of rows) {
    const tMs = row.bucket.getTime();
    const pages = bucketMap.get(tMs) ?? new Map<string, number>();
    if (!bucketMap.has(tMs)) bucketMap.set(tMs, pages);
    const key = row.pathname ?? "(unknown)";
    pages.set(key, (pages.get(key) ?? 0) + Number(row.n));
  }

  return Array.from(bucketMap.entries()).map(([tMs, pages]) => {
    const sorted = Array.from(pages.entries())
      .map(([pathname, count]) => ({ pathname, count }))
      .sort((a, b) => b.count - a.count);
    const total = sorted.reduce((sum, p) => sum + p.count, 0);
    return {
      t: new Date(tMs).toISOString(),
      total,
      byPage: sorted.slice(0, MAX_TOP_PAGES_PER_BUCKET),
    };
  });
}
