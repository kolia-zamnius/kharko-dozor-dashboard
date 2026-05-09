import { buildCursorResponse, parseLimitParam } from "@/app/api/_lib/pagination";
import { withAuth } from "@/app/api/_lib/with-auth";
import { paginatedSessionsSchema } from "@/api-client/sessions/schemas";
import { requireResourceAccess } from "@/server/auth/permissions";
import { prisma } from "@/server/db/client";
import { REAL_SESSION_FILTER } from "@/server/sessions/real-session-filter";
import { HttpError } from "@/server/http-error";
import { NextResponse } from "next/server";

type Params = { userId: string };

/** Slim rows — no event payload or trait JSON. Callers hydrate per-row via the session detail endpoint. */
export const GET = withAuth<Params>(async (req, user, { userId }) => {
  const trackedUser = await prisma.trackedUser.findUnique({
    where: { id: userId },
    select: { id: true, projectId: true, project: { select: { name: true, organizationId: true } } },
  });

  if (!trackedUser) {
    throw new HttpError(404, "User not found");
  }

  await requireResourceAccess(user.id, user.activeOrganizationId, trackedUser.project.organizationId, "VIEWER");

  const url = new URL(req.url);
  const cursor = url.searchParams.get("cursor");
  const limit = parseLimitParam(url.searchParams.get("limit"));

  const sessions = await prisma.session.findMany({
    where: { trackedUserId: trackedUser.id, ...REAL_SESSION_FILTER },
    select: {
      id: true,
      externalId: true,
      projectId: true,
      url: true,
      duration: true,
      eventCount: true,
      createdAt: true,
      trackedUserId: true,
    },
    orderBy: { createdAt: "desc" },
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  // `userDisplayName: null` — this sub-route always renders inside the user-detail
  // page where the identity is already surfaced; skipping `resolveDisplayName` per row.
  const enriched = sessions.map((s) => ({
    id: s.id,
    externalId: s.externalId,
    projectId: s.projectId,
    projectName: trackedUser.project.name,
    url: s.url,
    duration: s.duration,
    eventCount: s.eventCount,
    createdAt: s.createdAt.toISOString(),
    trackedUserId: s.trackedUserId,
    userId: null,
    userDisplayName: null,
    userTraits: null,
  }));

  return NextResponse.json(paginatedSessionsSchema.parse(buildCursorResponse(enriched, limit, "id")));
});
