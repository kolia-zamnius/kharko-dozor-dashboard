import { withAuth } from "@/app/api/_lib/with-auth";
import { ACTIVITY_CONFIG, parseActivityRange } from "@/api-client/tracked-users/domain";
import { userTimelineSchema } from "@/api-client/tracked-users/response-schemas";
import { requireResourceAccess } from "@/server/auth/permissions";
import { prisma } from "@/server/db/client";
import { HttpError } from "@/server/http-error";
import { NextResponse } from "next/server";

type Params = { userId: string };

/**
 * `GET /api/tracked-users/[userId]/timeline` — sessions timeline in a rolling window.
 *
 * VIEWER+.
 *
 * @remarks
 * `?range=6h|24h|7d` matches the histogram + stats range. Server
 * computes `from = now - windowMs` itself — sending raw ISO strings
 * from the client would shift the TanStack Query key on every render
 * and break cache dedup. The response echoes `from` / `to` so the
 * renderer can axis-scale against the exact window the server used.
 */
export const GET = withAuth<Params>(async (req, user, { userId }) => {
  const trackedUser = await prisma.trackedUser.findUnique({
    where: { id: userId },
    select: { id: true, projectId: true, project: { select: { organizationId: true } } },
  });

  if (!trackedUser) {
    throw new HttpError(404, "User not found");
  }

  await requireResourceAccess(user.id, user.activeOrganizationId, trackedUser.project.organizationId, "VIEWER");

  const url = new URL(req.url);
  const range = parseActivityRange(url.searchParams.get("range"));
  const cfg = ACTIVITY_CONFIG[range];

  const to = new Date();
  const from = new Date(to.getTime() - cfg.windowMs);

  const sessions = await prisma.session.findMany({
    where: {
      trackedUserId: trackedUser.id,
      // Overlap with [from, to]: started before window end AND (ended after window start OR still open).
      startedAt: { lte: to },
      OR: [{ endedAt: { gte: from } }, { endedAt: null }],
    },
    select: {
      id: true,
      externalId: true,
      startedAt: true,
      endedAt: true,
      duration: true,
      url: true,
      slices: {
        select: {
          url: true,
          pathname: true,
          reason: true,
          startedAt: true,
          endedAt: true,
          duration: true,
        },
        orderBy: { index: "asc" },
      },
    },
    orderBy: { startedAt: "asc" },
  });

  // `pages[]` is kept for backward compat with older consumers — the current UI has no page filter.
  const pagesSet = new Set<string>();
  for (const session of sessions) {
    for (const slice of session.slices) {
      pagesSet.add(slice.pathname);
    }
  }

  return NextResponse.json(
    userTimelineSchema.parse({
      range,
      from: from.toISOString(),
      to: to.toISOString(),
      sessions: sessions.map((s) => ({
        id: s.id,
        externalId: s.externalId,
        startedAt: s.startedAt.toISOString(),
        endedAt: s.endedAt?.toISOString() ?? null,
        duration: s.duration,
        url: s.url,
        slices: s.slices.map((sl) => ({
          url: sl.url,
          pathname: sl.pathname,
          reason: sl.reason,
          startedAt: sl.startedAt.toISOString(),
          endedAt: sl.endedAt?.toISOString() ?? null,
          duration: sl.duration,
        })),
      })),
      pages: Array.from(pagesSet).sort(),
    }),
    { headers: { "Cache-Control": "no-store" } },
  );
});
