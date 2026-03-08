import "server-only";

import { prisma } from "@/server/db/client";

type SessionAggRow = {
  session_count: bigint;
  total_duration: bigint | null;
};

type EventAggRow = {
  total_events: bigint;
  first_event_ms: bigint | null;
  last_event_ms: bigint | null;
};

/** KPI summary row for the activity page. */
export type ActivityAggregates = {
  readonly sessionCount: number;
  readonly totalActiveTime: number;
  readonly totalEvents: number;
  readonly firstEventAt: string | null;
  readonly lastEventAt: string | null;
};

/**
 * Session + event aggregates inside `[from, to)` for the activity page.
 *
 * @remarks
 * Single helper (not two) because the route always needs both, and
 * Prisma's driver pipelines `$queryRaw` calls inside `Promise.all` —
 * so splitting wouldn't buy latency, just cognitive overhead.
 *
 * @param trackedUserId - Internal tracked-user primary key.
 * @param from - Window start (inclusive).
 * @param to - Window end (exclusive).
 */
export async function computeActivityAggregates(
  trackedUserId: string,
  from: Date,
  to: Date,
): Promise<ActivityAggregates> {
  const fromMs = BigInt(from.getTime());
  const toMs = BigInt(to.getTime());

  const [sessionRows, eventRows] = await Promise.all([
    prisma.$queryRaw<SessionAggRow[]>`
      SELECT
        COUNT(*)::bigint AS session_count,
        SUM(duration)::bigint AS total_duration
      FROM "Session"
      WHERE "trackedUserId" = ${trackedUserId}
        AND "startedAt" >= ${from}
        AND "startedAt" <  ${to}
    `,
    prisma.$queryRaw<EventAggRow[]>`
      SELECT
        COUNT(*)::bigint AS total_events,
        MIN(e.timestamp)::bigint AS first_event_ms,
        MAX(e.timestamp)::bigint AS last_event_ms
      FROM "Event" e
      JOIN "Session" s ON s.id = e."sessionId"
      WHERE s."trackedUserId" = ${trackedUserId}
        AND e.timestamp >= ${fromMs}
        AND e.timestamp <  ${toMs}
    `,
  ]);

  const sessionAgg = sessionRows[0];
  const eventAgg = eventRows[0];

  return {
    sessionCount: Number(sessionAgg?.session_count ?? BigInt(0)),
    totalActiveTime: Number(sessionAgg?.total_duration ?? BigInt(0)),
    totalEvents: Number(eventAgg?.total_events ?? BigInt(0)),
    firstEventAt: eventAgg?.first_event_ms != null ? new Date(Number(eventAgg.first_event_ms)).toISOString() : null,
    lastEventAt: eventAgg?.last_event_ms != null ? new Date(Number(eventAgg.last_event_ms)).toISOString() : null,
  };
}
