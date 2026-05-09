import { withAuth } from "@/app/api/_lib/with-auth";
import { ACTIVITY_CONFIG, parseActivityRange } from "@/api-client/tracked-users/domain";
import { parsePageLimit } from "@/api-client/tracked-users/domain";
import { userActivitySchema, type ActivitySummary } from "@/api-client/tracked-users/schemas";
import { requireResourceAccess } from "@/server/auth/permissions";
import { prisma } from "@/server/db/client";
import { HttpError } from "@/server/http-error";
import { NextResponse } from "next/server";
import { computeActivityAggregates } from "./_helpers/aggregates";
import { computeActivityHistogram } from "./_helpers/histogram";
import { computePageDistribution, projectPageDistribution } from "./_helpers/pages";

type Params = { userId: string };

/**
 * Three independent SQL calls in parallel — histogram, page distribution,
 * KPI aggregates. `no-store` because the histogram advances with each ingest.
 */
export const GET = withAuth<Params>(async (req, user, { userId }) => {
  const trackedUser = await prisma.trackedUser.findUnique({
    where: { id: userId },
    select: { id: true, project: { select: { organizationId: true } } },
  });

  if (!trackedUser) {
    throw new HttpError(404, "User not found");
  }

  await requireResourceAccess(user.id, user.activeOrganizationId, trackedUser.project.organizationId, "VIEWER");

  const url = new URL(req.url);
  const range = parseActivityRange(url.searchParams.get("range"));
  const pageLimit = parsePageLimit(url.searchParams.get("pageLimit"));
  const cfg = ACTIVITY_CONFIG[range];

  const to = new Date();
  const from = new Date(to.getTime() - cfg.windowMs);

  // ~60% latency cut on a warm DB vs sequential awaits.
  const [histogramBuckets, pageSnapshot, aggregates] = await Promise.all([
    computeActivityHistogram(trackedUser.id, from, to, cfg.pgInterval),
    computePageDistribution(trackedUser.id, from, to),
    computeActivityAggregates(trackedUser.id, from, to),
  ]);

  const summary: ActivitySummary = {
    sessionCount: aggregates.sessionCount,
    totalActiveTime: aggregates.totalActiveTime,
    avgSessionDuration:
      aggregates.sessionCount > 0 ? Math.round(aggregates.totalActiveTime / aggregates.sessionCount) : 0,
    totalEvents: aggregates.totalEvents,
    // Full distribution count (not the `pageLimit`-trimmed slice) — the client compares against `pageDistribution.length` for "Show more".
    uniquePages: pageSnapshot.totalUniquePages,
    topPage: pageSnapshot.topPathname,
    firstEventAt: aggregates.firstEventAt,
    lastEventAt: aggregates.lastEventAt,
  };

  return NextResponse.json(
    userActivitySchema.parse({
      range,
      from: from.toISOString(),
      to: to.toISOString(),
      bucketMs: cfg.bucketMs,
      buckets: histogramBuckets,
      pageDistribution: projectPageDistribution(pageSnapshot, pageLimit),
      summary,
    }),
    { headers: { "Cache-Control": "no-store" } },
  );
});
