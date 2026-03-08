import { buildCursorResponse, parseLimitParam } from "@/app/api/_lib/pagination";
import { withAuth } from "@/app/api/_lib/with-auth";
import type { Prisma } from "@/generated/prisma/client";
import { dateRangeToFrom, DEFAULT_SESSION_DATE_RANGE } from "@/api-client/sessions/domain";
import { paginatedSessionsSchema } from "@/api-client/sessions/response-schemas";
import { sessionListParamsSchema } from "@/api-client/sessions/validators";
import { requireMember } from "@/server/auth/permissions";
import { resolveDisplayName } from "@/api-client/tracked-users/resolve-display-name";
import { prisma } from "@/server/db/client";
import { NextResponse } from "next/server";

/**
 * `GET /api/sessions` — cursor-paginated session list scoped to the active org.
 *
 * VIEWER+. Search by external id, project filter, date-range preset
 * (`today` / `7d` / `30d` / `all`), sort by date or duration.
 *
 * @remarks
 * Display-name resolution runs server-side (4-level fallback via
 * {@link resolveDisplayName}) so each row ships with the final
 * string. `?projectIds=` is re-intersected against the caller's org
 * server-side to prevent cross-org leakage.
 *
 * @see {@link sessionsListOptions} — client-side consumer.
 */
export const GET = withAuth(async (req, user) => {
  const activeOrgId = user.activeOrganizationId;
  if (!activeOrgId) {
    return NextResponse.json({ error: "No active organization" }, { status: 400 });
  }

  await requireMember(user.id, activeOrgId, "VIEWER");

  // ── Parse & validate query params ──────────────────────────────────────
  const url = new URL(req.url);
  const raw = Object.fromEntries(url.searchParams.entries());
  const params = sessionListParamsSchema.parse(raw);

  const limit = parseLimitParam(params.limit);
  const sort = params.sort ?? "date";
  const sortDir = params.sortDir ?? "desc";

  // ── Scope to org's projects ────────────────────────────────────────────
  const orgProjects = await prisma.project.findMany({
    where: { organizationId: activeOrgId },
    select: { id: true, name: true, defaultDisplayNameTraitKey: true },
  });

  const orgProjectIds = orgProjects.map((p) => p.id);
  if (orgProjectIds.length === 0) {
    return NextResponse.json(paginatedSessionsSchema.parse({ data: [], nextCursor: null }));
  }

  const projectNameMap = new Map(orgProjects.map((p) => [p.id, p.name]));
  const projectTraitKeyMap = new Map(orgProjects.map((p) => [p.id, p.defaultDisplayNameTraitKey]));

  // Filter by specific projects if requested, but always scope to org
  let projectFilter = orgProjectIds;
  if (params.projectIds?.length) {
    const requested = params.projectIds.filter((id) => orgProjectIds.includes(id));
    if (requested.length > 0) projectFilter = requested;
  }

  // ── Build where clause ─────────────────────────────────────────────────
  const where: Prisma.SessionWhereInput = {
    projectId: { in: projectFilter },
    ...(params.search ? { externalId: { contains: params.search, mode: "insensitive" as const } } : {}),
  };

  // Date range filter — compute UTC boundary from the preset name.
  // Missing `?range=` defaults to the widest preset, which is anchored
  // to `SESSION_RETENTION_MS` on the client side, so the server never
  // queries for rows older than the cron would have hard-deleted anyway.
  const rangeFrom = dateRangeToFrom(params.range ?? DEFAULT_SESSION_DATE_RANGE);
  where.createdAt = { gte: rangeFrom };

  // ── Sort mapping ───────────────────────────────────────────────────────
  const orderBy: Prisma.SessionOrderByWithRelationInput =
    sort === "duration" ? { duration: sortDir } : { createdAt: sortDir };

  // ── Query ──────────────────────────────────────────────────────────────
  const sessions = await prisma.session.findMany({
    where,
    select: {
      id: true,
      externalId: true,
      projectId: true,
      url: true,
      duration: true,
      eventCount: true,
      createdAt: true,
      trackedUserId: true,
      trackedUser: {
        select: { externalId: true, traits: true, customName: true, displayNameTraitKey: true },
      },
      _count: { select: { slices: true } },
    },
    orderBy,
    take: limit + 1,
    ...(params.cursor ? { cursor: { id: params.cursor }, skip: 1 } : {}),
  });

  const enriched = sessions.map((s) => {
    const traits = (s.trackedUser?.traits as Record<string, unknown>) ?? null;

    // Resolve display name using the same 4-level chain as the users list.
    const userDisplayName = s.trackedUser
      ? resolveDisplayName({
          externalId: s.trackedUser.externalId,
          traits,
          customName: s.trackedUser.customName ?? null,
          displayNameTraitKey: s.trackedUser.displayNameTraitKey ?? null,
          projectDefaultTraitKey: projectTraitKeyMap.get(s.projectId) ?? null,
        })
      : null;

    return {
      id: s.id,
      externalId: s.externalId,
      projectId: s.projectId,
      projectName: projectNameMap.get(s.projectId) ?? "Unknown",
      url: s.url,
      duration: s.duration,
      eventCount: s.eventCount,
      createdAt: s.createdAt.toISOString(),
      trackedUserId: s.trackedUserId,
      userId: s.trackedUser?.externalId ?? null,
      userDisplayName,
      userTraits: traits,
      sliceCount: s._count.slices,
    };
  });

  return NextResponse.json(paginatedSessionsSchema.parse(buildCursorResponse(enriched, limit, "id")));
});
