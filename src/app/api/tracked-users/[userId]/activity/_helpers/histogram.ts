import "server-only";

import { MAX_TOP_PAGES_PER_BUCKET } from "@/app/api/_lib/constants";
import { Prisma } from "@/generated/prisma/client";
import type { ActivityBucket } from "@/api-client/tracked-users/types";
import { prisma } from "@/server/db/client";

type BucketRow = {
  bucket: Date;
  pathname: string | null;
  n: bigint;
};

/**
 * `date_bin()` anchors at `'2020-01-01'` (not `from`) — bucket boundaries stay
 * stable across consecutive requests 200ms apart, preventing shimmering bars
 * and TanStack cache misses.
 *
 * `pgInterval` is `Prisma.raw`-interpolated — safe because it comes from
 * `ACTIVITY_CONFIG` (a closed string union); the range parser rejects
 * anything outside it.
 */
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
    SELECT
      date_bin(
        ${intervalFragment},
        to_timestamp(e.timestamp::double precision / 1000),
        timestamp '2020-01-01'
      ) AS bucket,
      sl.pathname AS pathname,
      COUNT(*)::bigint AS n
    FROM "Event" e
    JOIN "Session" s ON s.id = e."sessionId"
    LEFT JOIN "Slice" sl ON sl.id = e."sliceId"
    WHERE s."trackedUserId" = ${trackedUserId}
      AND e.timestamp >= ${fromMs}
      AND e.timestamp <  ${toMs}
    GROUP BY bucket, sl.pathname
    ORDER BY bucket ASC
  `;

  return assembleBuckets(rows);
}

/** SQL `ORDER BY bucket ASC` + Map insertion order (ES2015) preserves input order on output. */
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
