import "server-only";

import type { PageDistribution } from "@/api-client/tracked-users/types";
import { prisma } from "@/server/db/client";
import { REAL_SESSION_FILTER } from "@/server/sessions/real-session-filter";

export type PageDistributionSnapshot = {
  readonly rows: readonly { pathname: string; durationMs: number; visits: number }[];
  readonly totalDurationMs: number;
  readonly totalUniquePages: number;
  readonly topPathname: string | null;
};

type UrlMarkerRow = { sessionId: string; timestamp: bigint; data: { pathname?: string; url?: string } };
type SessionRow = { id: string; startedAt: Date; endedAt: Date | null; url: string | null };

// Pages = Marker(kind='url') periods, where each period spans from one url
// marker to the next (or to the session's `lastEventAt` for the final marker).
// Sessions without any url marker fall back to a single period covering the
// session's whole [startedAt, endedAt] window, attributed to `Session.url`.
export async function computePageDistribution(
  trackedUserId: string,
  from: Date,
  to: Date,
): Promise<PageDistributionSnapshot> {
  const sessions: SessionRow[] = await prisma.session.findMany({
    where: {
      trackedUserId,
      ...REAL_SESSION_FILTER,
      startedAt: { lte: to },
      OR: [{ endedAt: { gte: from } }, { endedAt: null }],
    },
    select: { id: true, startedAt: true, endedAt: true, url: true },
  });
  const idToInitialUrl = new Map(sessions.map((s) => [s.id, s.url] as const));

  const sessionIds = sessions.map((s) => s.id);

  const markers: UrlMarkerRow[] =
    sessionIds.length > 0
      ? ((await prisma.marker.findMany({
          where: { sessionId: { in: sessionIds }, kind: "url" },
          select: { sessionId: true, timestamp: true, data: true },
          orderBy: [{ sessionId: "asc" }, { timestamp: "asc" }],
        })) as UrlMarkerRow[])
      : [];

  const totals = new Map<string, { durationMs: number; visits: number }>();

  // Group markers by session so we can compute next-marker boundaries per session.
  const bySession = new Map<string, UrlMarkerRow[]>();
  for (const m of markers) {
    const arr = bySession.get(m.sessionId) ?? [];
    arr.push(m);
    if (arr.length === 1) bySession.set(m.sessionId, arr);
  }

  for (const session of sessions) {
    const sessionMarkers = bySession.get(session.id) ?? [];
    const sessionEnd = (session.endedAt ?? to).getTime();

    if (sessionMarkers.length === 0) {
      const initialUrl = idToInitialUrl.get(session.id);
      if (initialUrl) {
        const pathname = safeDerivePathname(initialUrl);
        const startMs = Math.max(session.startedAt.getTime(), from.getTime());
        const endMs = Math.min(sessionEnd, to.getTime());
        const slot = totals.get(pathname) ?? { durationMs: 0, visits: 0 };
        slot.visits += 1;
        if (endMs > startMs) slot.durationMs += endMs - startMs;
        totals.set(pathname, slot);
      }
      continue;
    }

    for (let i = 0; i < sessionMarkers.length; i++) {
      const m = sessionMarkers[i]!;
      // `min(..., sessionEnd)` clamps clock-skewed markers (rrweb timestamp > server-recorded
      // session end) so a stray future-stamped marker can't silently consume the next period.
      const rawStart = Math.min(Number(m.timestamp), sessionEnd);
      const rawEnd =
        i + 1 < sessionMarkers.length ? Math.min(Number(sessionMarkers[i + 1]!.timestamp), sessionEnd) : sessionEnd;
      const startMs = Math.max(rawStart, from.getTime());
      const endMs = Math.min(rawEnd, to.getTime());
      if (endMs <= startMs) continue;

      const pathname = typeof m.data?.pathname === "string" ? m.data.pathname : safeDerivePathname(m.data?.url ?? "");
      const slot = totals.get(pathname) ?? { durationMs: 0, visits: 0 };
      slot.durationMs += endMs - startMs;
      slot.visits += 1;
      totals.set(pathname, slot);
    }
  }

  const rows = Array.from(totals.entries())
    .map(([pathname, v]) => ({ pathname, durationMs: v.durationMs, visits: v.visits }))
    .sort((a, b) => b.durationMs - a.durationMs);

  const totalDurationMs = rows.reduce((sum, r) => sum + r.durationMs, 0);

  return {
    rows,
    totalDurationMs,
    totalUniquePages: rows.length,
    topPathname: rows[0]?.pathname ?? null,
  };
}

// `share` is against the full-distribution total so percentages stay correct under any `pageLimit`.
export function projectPageDistribution(snapshot: PageDistributionSnapshot, pageLimit: number): PageDistribution[] {
  const { rows, totalDurationMs } = snapshot;
  return rows.slice(0, pageLimit).map((r) => ({
    pathname: r.pathname,
    duration: Math.round(r.durationMs / 1000),
    share: totalDurationMs > 0 ? r.durationMs / totalDurationMs : 0,
    visits: r.visits,
  }));
}

function safeDerivePathname(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return "/";
  }
}
