import "server-only";

import { MIN_REAL_SESSION_DURATION_SECONDS, MIN_REAL_SESSION_EVENTS } from "@/lib/time";
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

export type ActivityAggregates = {
  readonly sessionCount: number;
  readonly totalActiveTime: number;
  readonly totalEvents: number;
  readonly firstEventAt: string | null;
  readonly lastEventAt: string | null;
};

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
        AND "eventCount" >= ${MIN_REAL_SESSION_EVENTS}
        AND duration     >= ${MIN_REAL_SESSION_DURATION_SECONDS}
    `,
    prisma.$queryRaw<EventAggRow[]>`
      SELECT
        COALESCE(SUM(eb."eventCount"), 0)::bigint AS total_events,
        MIN(eb."firstTimestamp")::bigint          AS first_event_ms,
        MAX(eb."lastTimestamp")::bigint           AS last_event_ms
      FROM "EventBatch" eb
      JOIN "Session" s ON s.id = eb."sessionId"
      WHERE s."trackedUserId" = ${trackedUserId}
        AND eb."firstTimestamp" >= ${fromMs}
        AND eb."firstTimestamp" <  ${toMs}
        AND s."eventCount" >= ${MIN_REAL_SESSION_EVENTS}
        AND s.duration     >= ${MIN_REAL_SESSION_DURATION_SECONDS}
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
