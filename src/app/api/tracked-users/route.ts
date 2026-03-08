import { buildCursorResponse, parseLimitParam } from "@/app/api/_lib/pagination";
import { withAuth } from "@/app/api/_lib/with-auth";
import { paginatedTrackedUsersSchema } from "@/api-client/tracked-users/response-schemas";
import { userListParamsSchema } from "@/api-client/tracked-users/validators";
import { SEVEN_DAYS_MS } from "@/lib/time";
import { requireMember } from "@/server/auth/permissions";
import { prisma } from "@/server/db/client";
import { NextResponse } from "next/server";
import { enrichTrackedUser, type ProjectMetadata } from "./_helpers/enrich";
import { filterEnrichedTrackedUsers } from "./_helpers/filter";
import { sortEnrichedTrackedUsers } from "./_helpers/sort";

/**
 * `GET /api/tracked-users` — cursor-paginated tracked-user list scoped to the active org.
 *
 * VIEWER+. Search by external id OR resolved display name, project
 * scope, status filter, sort by last-seen / sessions / active-time /
 * newest.
 *
 * @remarks
 * Pipeline is linear: parse params → scope projects → fetch rows →
 * {@link enrichTrackedUser} → {@link filterEnrichedTrackedUsers} →
 * {@link sortEnrichedTrackedUsers} → {@link buildCursorResponse}.
 *
 * In-JS filter/sort is fast because the Prisma query caps at
 * `limit + 1` rows (or 500 when status-filtering, since status is
 * derived and not indexable). Past ~10k users per org, the next step
 * is a `$queryRaw` CTE with indexed `MAX(sessions.endedAt)` —
 * flagged here so future-you doesn't discover it as a surprise.
 *
 * @see {@link trackedUsersListOptions} — client-side consumer.
 */
export const GET = withAuth(async (req, user) => {
  const activeOrgId = user.activeOrganizationId;
  if (!activeOrgId) {
    return NextResponse.json({ error: "No active organization" }, { status: 400 });
  }

  await requireMember(user.id, activeOrgId, "VIEWER");

  const url = new URL(req.url);
  const params = userListParamsSchema.parse(Object.fromEntries(url.searchParams.entries()));
  const limit = parseLimitParam(params.limit);

  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - SEVEN_DAYS_MS);

  // ── Scope to caller's org projects ────────────────────────────────────
  const orgProjects = await prisma.project.findMany({
    where: { organizationId: activeOrgId },
    select: { id: true, name: true, defaultDisplayNameTraitKey: true },
  });

  if (orgProjects.length === 0) {
    return NextResponse.json(paginatedTrackedUsersSchema.parse({ data: [], nextCursor: null }));
  }

  const projectMap = new Map<string, ProjectMetadata>(orgProjects.map((p) => [p.id, p]));
  const orgProjectIds = orgProjects.map((p) => p.id);

  // Always intersect `?projectIds=` with caller's org — stray ids are dropped, not trusted.
  const projectFilter =
    params.projectIds?.length && params.projectIds.some((id) => orgProjectIds.includes(id))
      ? params.projectIds.filter((id) => orgProjectIds.includes(id))
      : orgProjectIds;

  // ── Fetch candidate rows ──────────────────────────────────────────────
  // Over-fetch 500 when status filter is active (status is derived,
  // can't narrow in SQL). Cursor skipped in the same path — combining
  // it with post-fetch drops would produce unstable pagination.
  const hasStatusFilter = Boolean(params.statuses?.length);

  const rows = await prisma.trackedUser.findMany({
    where: {
      projectId: { in: projectFilter },
      ...(params.search
        ? {
            OR: [
              { externalId: { contains: params.search, mode: "insensitive" as const } },
              { customName: { contains: params.search, mode: "insensitive" as const } },
            ],
          }
        : {}),
    },
    select: {
      id: true,
      externalId: true,
      projectId: true,
      traits: true,
      customName: true,
      displayNameTraitKey: true,
      createdAt: true,
      _count: { select: { sessions: true } },
      sessions: { select: { endedAt: true, duration: true, startedAt: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: hasStatusFilter ? 500 : limit + 1,
    ...(params.cursor && !hasStatusFilter ? { cursor: { id: params.cursor }, skip: 1 } : {}),
  });

  // ── Enrich → filter → sort ────────────────────────────────────────────
  const enriched = rows.map((row) => enrichTrackedUser(row, { projectMap, sevenDaysAgo, now }));
  const filtered = filterEnrichedTrackedUsers(enriched, params);
  const sorted = sortEnrichedTrackedUsers(filtered, params.sort ?? "last-seen", params.sortDir ?? "desc");

  return NextResponse.json(paginatedTrackedUsersSchema.parse(buildCursorResponse(sorted, limit, "id")));
});
