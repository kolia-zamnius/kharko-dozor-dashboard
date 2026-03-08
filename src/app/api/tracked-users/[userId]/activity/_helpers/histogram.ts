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
 * Time-bucketed, page-split activity histogram for one tracked user.
 *
 * @remarks
 * `date_bin()` snaps each event to a fixed grid anchored at
 * `'2020-01-01'` (not `from`) — that keeps bucket boundaries stable
 * across consecutive requests 200ms apart, preventing "shimmering"
 * bars and TanStack cache misses on the client.
 *
 * `pgInterval` is interpolated as raw SQL, which is safe because it
 * comes from the hardcoded `ACTIVITY_CONFIG` record (`"5 minutes" |
 * "15 minutes" | "1 hour"`). The range parser rejects anything
 * outside the union before it reaches this helper.
 *
 * @param trackedUserId - Internal tracked-user primary key.
 * @param from - Window start (inclusive).
 * @param to - Window end (exclusive).
 * @param pgInterval - Bucket width as a Postgres interval literal.
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

/**
 * Fold the flat `(bucket × pathname)` result set into one row per bucket.
 *
 * @remarks
 * The DB `ORDER BY bucket ASC` guarantees input order; `Map` insertion
 * order (spec-guaranteed since ES2015) preserves it on the way out.
 */
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
