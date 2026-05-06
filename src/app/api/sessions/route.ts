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
 * Display-name resolved server-side (4-level chain) so each row ships final.
 * `?projectIds=` re-intersected with the caller's org — stray IDs are dropped.
 */
export const GET = withAuth(async (req, user) => {
  const activeOrgId = user.activeOrganizationId;
  if (!activeOrgId) {
    return NextResponse.json({ error: "No active organization" }, { status: 400 });
  }

  await requireMember(user.id, activeOrgId, "VIEWER");

  const url = new URL(req.url);
  const raw = Object.fromEntries(url.searchParams.entries());
  const params = sessionListParamsSchema.parse(raw);

  const limit = parseLimitParam(params.limit);
  const sort = params.sort ?? "date";
  const sortDir = params.sortDir ?? "desc";

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

  let projectFilter = orgProjectIds;
  if (params.projectIds?.length) {
    const requested = params.projectIds.filter((id) => orgProjectIds.includes(id));
    if (requested.length > 0) projectFilter = requested;
  }

  const where: Prisma.SessionWhereInput = {
    projectId: { in: projectFilter },
    ...(params.search ? { externalId: { contains: params.search, mode: "insensitive" as const } } : {}),
  };

  // Default range is anchored to `SESSION_RETENTION_MS` so the server never
  // queries past what the cron would have already deleted.
  const rangeFrom = dateRangeToFrom(params.range ?? DEFAULT_SESSION_DATE_RANGE);
  where.createdAt = { gte: rangeFrom };

  const orderBy: Prisma.SessionOrderByWithRelationInput =
    sort === "duration" ? { duration: sortDir } : { createdAt: sortDir };

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
    },
    orderBy,
    take: limit + 1,
    ...(params.cursor ? { cursor: { id: params.cursor }, skip: 1 } : {}),
  });

  const enriched = sessions.map((s) => {
    const traits = (s.trackedUser?.traits as SessionTraits | null) ?? null;

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
    };
  });

  return NextResponse.json(paginatedSessionsSchema.parse(buildCursorResponse(enriched, limit, "id")));
});
