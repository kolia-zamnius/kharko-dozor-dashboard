import { buildCursorResponse, parseLimitParam } from "@/app/api/_lib/pagination";
import { withAuth } from "@/app/api/_lib/with-auth";
import { paginatedSessionsSchema } from "@/api-client/sessions/response-schemas";
import { requireResourceAccess } from "@/server/auth/permissions";
import { prisma } from "@/server/db/client";
import { HttpError } from "@/server/http-error";
import { NextResponse } from "next/server";

type Params = { userId: string };

/**
 * `GET /api/tracked-users/[userId]/sessions` — cursor-paginated sessions for one user.
 *
 * VIEWER+ of the owning org.
 *
 * @remarks
 * Ordered by most-recent first. Rows are slim (no event payload, no
 * trait JSON) — callers hydrate details per row via the session
 * detail endpoint on demand.
 */
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
    where: { trackedUserId: trackedUser.id },
    select: {
      id: true,
      externalId: true,
      projectId: true,
      url: true,
      duration: true,
      eventCount: true,
      createdAt: true,
      trackedUserId: true,
      _count: { select: { slices: true } },
    },
    orderBy: { createdAt: "desc" },
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  // Shape matches `SessionListItem`; `userDisplayName` is nominally the
  // viewed user's name but kept `null` here because this sub-route is
  // always rendered inside the user-detail page where that identity is
  // already surfaced above the table. Leaving it null avoids a second
  // `resolveDisplayName` call per row. Pre-schema this field was
  // accidentally missing entirely — the zod parse now fails fast if it
  // regresses.
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
    sliceCount: s._count.slices,
  }));

  return NextResponse.json(paginatedSessionsSchema.parse(buildCursorResponse(enriched, limit, "id")));
});
