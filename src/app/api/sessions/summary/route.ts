import { withAuth } from "@/app/api/_lib/with-auth";
import { sessionsSummarySchema } from "@/api-client/sessions/schemas";
import { ONE_DAY_MS } from "@/lib/time";
import { requireMember } from "@/server/auth/permissions";
import { prisma } from "@/server/db/client";
import { NextResponse } from "next/server";

/** Single `$queryRaw` with `COUNT FILTER` — one round-trip vs four Prisma queries. */
export const GET = withAuth(async (_req, user) => {
  const activeOrgId = user.activeOrganizationId;
  if (!activeOrgId) {
    return NextResponse.json({ error: "No active organization" }, { status: 400 });
  }

  await requireMember(user.id, activeOrgId, "VIEWER");

  const activeToday = new Date(Date.now() - ONE_DAY_MS);

  const result = await prisma.$queryRaw<
    [{ total: bigint; total_duration: bigint; avg_duration: number; active_today: bigint }]
  >`
    SELECT
      COUNT(*)::bigint                                                     AS total,
      COALESCE(SUM(s.duration), 0)::bigint                                AS total_duration,
      COALESCE(AVG(s.duration), 0)::float                                 AS avg_duration,
      COUNT(*) FILTER (WHERE s."createdAt" >= ${activeToday})::bigint     AS active_today
    FROM "Session" s
    INNER JOIN "Project" p ON p.id = s."projectId"
    WHERE p."organizationId" = ${activeOrgId}
  `;

  const row = result[0];

  return NextResponse.json(
    sessionsSummarySchema.parse({
      totalSessions: Number(row.total),
      totalDuration: Number(row.total_duration),
      avgDuration: Math.round(Number(row.avg_duration)),
      activeToday: Number(row.active_today),
    }),
  );
});
