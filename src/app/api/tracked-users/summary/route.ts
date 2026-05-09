import { withAuth } from "@/app/api/_lib/with-auth";
import { ONLINE_THRESHOLD_MS } from "@/api-client/tracked-users/domain";
import { trackedUsersSummarySchema } from "@/api-client/tracked-users/schemas";
import { MIN_REAL_SESSION_DURATION_SECONDS, MIN_REAL_SESSION_EVENTS, ONE_DAY_MS, SEVEN_DAYS_MS } from "@/lib/time";
import { requireMember } from "@/server/auth/permissions";
import { prisma } from "@/server/db/client";
import { NextResponse } from "next/server";

/** Single `$queryRaw` + `LATERAL` for `MAX(Session.endedAt)` per user — one round-trip, one TrackedUser scan. */
export const GET = withAuth(async (_req, user) => {
  const activeOrgId = user.activeOrganizationId;
  if (!activeOrgId) {
    return NextResponse.json({ error: "No active organization" }, { status: 400 });
  }

  await requireMember(user.id, activeOrgId, "VIEWER");

  const now = new Date();
  const onlineThreshold = new Date(now.getTime() - ONLINE_THRESHOLD_MS);
  const active24hThreshold = new Date(now.getTime() - ONE_DAY_MS);
  const newThisWeekThreshold = new Date(now.getTime() - SEVEN_DAYS_MS);

  const result = await prisma.$queryRaw<
    [{ total: bigint; online_now: bigint; active_24h: bigint; new_this_week: bigint }]
  >`
    SELECT
      COUNT(*)::bigint                                                     AS total,
      COUNT(*) FILTER (WHERE last_event >= ${onlineThreshold})::bigint     AS online_now,
      COUNT(*) FILTER (WHERE last_event >= ${active24hThreshold})::bigint  AS active_24h,
      COUNT(*) FILTER (WHERE tu."createdAt" >= ${newThisWeekThreshold})::bigint AS new_this_week
    FROM "TrackedUser" tu
    INNER JOIN "Project" p ON p.id = tu."projectId"
    LEFT JOIN LATERAL (
      SELECT MAX(s."endedAt") AS last_event
      FROM "Session" s
      WHERE s."trackedUserId" = tu.id
        AND s."eventCount" >= ${MIN_REAL_SESSION_EVENTS}
        AND s.duration   >= ${MIN_REAL_SESSION_DURATION_SECONDS}
    ) ls ON true
    WHERE p."organizationId" = ${activeOrgId}
  `;

  const row = result[0];

  return NextResponse.json(
    trackedUsersSummarySchema.parse({
      total: Number(row.total),
      onlineNow: Number(row.online_now),
      active24h: Number(row.active_24h),
      newThisWeek: Number(row.new_this_week),
    }),
  );
});
