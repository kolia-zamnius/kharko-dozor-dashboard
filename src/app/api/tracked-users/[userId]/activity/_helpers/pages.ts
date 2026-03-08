import "server-only";

import type { PageDistribution } from "@/api-client/tracked-users/types";
import { prisma } from "@/server/db/client";

type PageDistRow = {
  pathname: string;
  duration_total: bigint;
  visits: bigint;
};

/**
 * Page-distribution snapshot — full list + invariant totals.
 *
 * @remarks
 * Returning both from one helper means the route can't build a
 * response where `uniquePages` / `topPage` / `share` drift when the
 * client changes `?pageLimit=`. Type-level invariant.
 */
export type PageDistributionSnapshot = {
  readonly rows: readonly PageDistRow[];
  readonly totalSliceDuration: number;
  readonly totalUniquePages: number;
  readonly topPathname: string | null;
};

/**
 * Run the page-distribution query and compute invariant totals.
 *
 * @remarks
 * Ordered `duration_total DESC` so `topPathname` is row 0. `visits` is
 * kept for the UI even though it doesn't feed the share computation.
 *
 * @param trackedUserId - Internal tracked-user primary key.
 * @param from - Window start (inclusive).
 * @param to - Window end (exclusive).
 */
export async function computePageDistribution(
  trackedUserId: string,
  from: Date,
  to: Date,
): Promise<PageDistributionSnapshot> {
  const rows = await prisma.$queryRaw<PageDistRow[]>`
    SELECT
      sl.pathname AS pathname,
      SUM(sl.duration)::bigint AS duration_total,
      COUNT(*)::bigint AS visits
    FROM "Slice" sl
    JOIN "Session" s ON s.id = sl."sessionId"
    WHERE s."trackedUserId" = ${trackedUserId}
      AND sl."startedAt" >= ${from}
      AND sl."startedAt" <  ${to}
    GROUP BY sl.pathname
    ORDER BY duration_total DESC
  `;

  const totalSliceDuration = rows.reduce((sum, r) => sum + Number(r.duration_total), 0);

  return {
    rows,
    totalSliceDuration,
    totalUniquePages: rows.length,
    topPathname: rows[0]?.pathname ?? null,
  };
}

/**
 * Project a snapshot + `pageLimit` into the response shape.
 *
 * @remarks
 * `share` is computed against `totalSliceDuration` — the full-
 * distribution total — so percentages stay correct no matter how
 * small `pageLimit` is.
 */
export function projectPageDistribution(snapshot: PageDistributionSnapshot, pageLimit: number): PageDistribution[] {
  const { rows, totalSliceDuration } = snapshot;
  return rows.slice(0, pageLimit).map((r) => ({
    pathname: r.pathname,
    duration: Number(r.duration_total),
    share: totalSliceDuration > 0 ? Number(r.duration_total) / totalSliceDuration : 0,
    visits: Number(r.visits),
  }));
}
