import { withAuth } from "@/app/api/_lib/with-auth";
import { ACTIVITY_CONFIG, parseActivityRange } from "@/api-client/tracked-users/domain";
import { userTimelineSchema } from "@/api-client/tracked-users/schemas";
import { requireResourceAccess } from "@/server/auth/permissions";
import { prisma } from "@/server/db/client";
import { REAL_SESSION_FILTER } from "@/server/sessions/real-session-filter";
import { HttpError } from "@/server/http-error";
import { NextResponse } from "next/server";

type Params = { userId: string };

type UrlMarker = { sessionId: string; timestamp: bigint; data: { url?: string; pathname?: string } };

// Periods are derived from successive `dozor:url` markers within each session:
// each period spans from one marker to the next (or to the session's `endedAt`
// for the last marker). Sessions without any url marker fall back to a single
// period across the full duration using `Session.url`.
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
      ...REAL_SESSION_FILTER,
      // [from, to] overlap — started before end AND (ended after start OR still open).
      startedAt: { lte: to },
      OR: [{ endedAt: { gte: from } }, { endedAt: null }],
    },
    select: { id: true, externalId: true, startedAt: true, endedAt: true, duration: true, url: true },
    orderBy: { startedAt: "asc" },
  });

  if (sessions.length === 0) {
    return NextResponse.json(
      userTimelineSchema.parse({
        range,
        from: from.toISOString(),
        to: to.toISOString(),
        sessions: [],
        pages: [],
      }),
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  const sessionIds = sessions.map((s) => s.id);
  const urlMarkers = await prisma.marker.findMany({
    where: { sessionId: { in: sessionIds }, kind: "url" },
    select: { sessionId: true, timestamp: true, data: true },
    orderBy: [{ sessionId: "asc" }, { timestamp: "asc" }],
  });

  const markersBySession = new Map<string, UrlMarker[]>();
  for (const m of urlMarkers) {
    const arr = markersBySession.get(m.sessionId) ?? [];
    arr.push(m as UrlMarker);
    if (arr.length === 1) markersBySession.set(m.sessionId, arr);
  }

  const pagesSet = new Set<string>();
  const responseSessions = sessions.map((session) => {
    const sessionEnd = session.endedAt ?? to;
    const markers = markersBySession.get(session.id) ?? [];
    const periods =
      markers.length === 0
        ? // Single fallback period using Session.url when no markers exist.
          session.url
          ? [
              {
                url: session.url,
                pathname: safeDerivePathname(session.url),
                startedAt: session.startedAt.toISOString(),
                endedAt: session.endedAt?.toISOString() ?? null,
                duration: session.duration,
              },
            ]
          : []
        : markers.map((m, i) => {
            const periodEnd = i + 1 < markers.length ? new Date(Number(markers[i + 1]!.timestamp)) : sessionEnd;
            const startMs = Number(m.timestamp);
            const endMs = periodEnd.getTime();
            const periodUrl = typeof m.data?.url === "string" ? m.data.url : (session.url ?? "");
            const periodPathname =
              typeof m.data?.pathname === "string" ? m.data.pathname : safeDerivePathname(periodUrl);
            pagesSet.add(periodPathname);
            return {
              url: periodUrl,
              pathname: periodPathname,
              startedAt: new Date(startMs).toISOString(),
              endedAt: i + 1 < markers.length || session.endedAt ? new Date(endMs).toISOString() : null,
              duration: Math.max(0, Math.round((endMs - startMs) / 1000)),
            };
          });

    for (const p of periods) pagesSet.add(p.pathname);

    return {
      id: session.id,
      externalId: session.externalId,
      startedAt: session.startedAt.toISOString(),
      endedAt: session.endedAt?.toISOString() ?? null,
      duration: session.duration,
      url: session.url,
      periods,
    };
  });

  return NextResponse.json(
    userTimelineSchema.parse({
      range,
      from: from.toISOString(),
      to: to.toISOString(),
      sessions: responseSessions,
      pages: Array.from(pagesSet).sort(),
    }),
    { headers: { "Cache-Control": "no-store" } },
  );
});

function safeDerivePathname(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return "/";
  }
}
