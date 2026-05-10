import { DOZOR_MARKER_TAG, RRWEB_EVENT_TYPE } from "@/lib/rrweb-constants";

import type { DozorEvent, HistoryCriteria, HistoryItem } from "./types";

type UrlMarkerData = { tag: string; payload: { url?: string; pathname?: string } };
type IdentityMarkerData = { tag: string; payload: { userId?: string; traits?: Record<string, unknown> } };

function isUrlMarker(event: DozorEvent): event is DozorEvent & { data: UrlMarkerData } {
  if (event.type !== RRWEB_EVENT_TYPE.Custom) return false;
  const data = event.data as { tag?: unknown } | null;
  return !!data && data.tag === DOZOR_MARKER_TAG.url;
}

function isIdentityMarker(event: DozorEvent): event is DozorEvent & { data: IdentityMarkerData } {
  if (event.type !== RRWEB_EVENT_TYPE.Custom) return false;
  const data = event.data as { tag?: unknown } | null;
  return !!data && data.tag === DOZOR_MARKER_TAG.identity;
}

function derivePathname(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).pathname;
  } catch {
    return null;
  }
}

/**
 * Pure — caller controls memoisation. `events` is sorted defensively in case caller didn't.
 *
 * Sections (`init`, `navigation`) chain head-to-tail; markers (`idle`, `identify`) nest inside
 * the surrounding section's range. The chain closes at `sessionEndedAt` for finished sessions or
 * at the last event's timestamp for live ones (so the trailing section grows as new batches
 * stream in).
 */
export function buildHistory(events: readonly DozorEvent[], criteria: HistoryCriteria): HistoryItem[] {
  if (events.length === 0) return [];

  const sorted = [...events].sort((a, b) => a.timestamp - b.timestamp);
  const firstTs = sorted[0]!.timestamp;
  const lastTs = sorted[sorted.length - 1]!.timestamp;
  const closingTs = criteria.sessionEndedAt ?? lastTs;

  const items: HistoryItem[] = [];
  let currentSectionIdx = items.length;
  items.push({
    id: `init-${firstTs}`,
    kind: "init",
    startedAt: firstTs,
    endedAt: closingTs,
    realDurationMs: 0,
    pathname: derivePathname(criteria.initialUrl),
    url: criteria.initialUrl ?? null,
  });

  let navCounter = 0;
  let identifyCounter = 0;
  let idleCounter = 0;

  for (let i = 0; i < sorted.length; i++) {
    const event = sorted[i]!;

    if (isUrlMarker(event)) {
      const url = typeof event.data.payload.url === "string" ? event.data.payload.url : null;
      const pathname = typeof event.data.payload.pathname === "string" ? event.data.payload.pathname : null;
      if (!url || !pathname) continue;

      const prev = items[currentSectionIdx];
      if (prev) prev.endedAt = event.timestamp;

      currentSectionIdx = items.length;
      items.push({
        id: `nav-${navCounter++}-${event.timestamp}`,
        kind: "navigation",
        startedAt: event.timestamp,
        endedAt: closingTs,
        realDurationMs: 0,
        pathname,
        url,
      });
      continue;
    }

    if (isIdentityMarker(event)) {
      const userId = typeof event.data.payload.userId === "string" ? event.data.payload.userId : null;
      if (!userId) continue;
      const traits =
        event.data.payload.traits && typeof event.data.payload.traits === "object" ? event.data.payload.traits : null;
      items.push({
        id: `identify-${identifyCounter++}-${event.timestamp}`,
        kind: "identify",
        startedAt: event.timestamp,
        endedAt: event.timestamp,
        realDurationMs: 0,
        userId,
        traits,
      });
      continue;
    }

    // Strict `>` so a gap == threshold isn't flagged — avoids flap when a session's natural
    // cadence sits right at the threshold.
    if (criteria.idleGapMs !== null && i > 0) {
      const prevEvent = sorted[i - 1]!;
      const gap = event.timestamp - prevEvent.timestamp;
      if (gap > criteria.idleGapMs) {
        items.push({
          id: `idle-${idleCounter++}-${prevEvent.timestamp}`,
          kind: "idle",
          startedAt: prevEvent.timestamp,
          endedAt: event.timestamp,
          realDurationMs: 0,
        });
      }
    }
  }

  for (const item of items) {
    item.realDurationMs = item.endedAt - item.startedAt;
  }

  return items;
}

/**
 * Find the history item whose range contains `absoluteMs`. Markers (`idle`) take priority over
 * sections (`init`/`navigation`) — same timestamp can fall in both, the marker is more specific.
 * `identify` items are zero-duration points and never match.
 */
export function findActiveHistoryItemId(items: readonly HistoryItem[], absoluteMs: number): string | null {
  for (const item of items) {
    if (item.kind === "idle" && absoluteMs >= item.startedAt && absoluteMs < item.endedAt) {
      return item.id;
    }
  }
  for (const item of items) {
    if (
      (item.kind === "init" || item.kind === "navigation") &&
      absoluteMs >= item.startedAt &&
      absoluteMs < item.endedAt
    ) {
      return item.id;
    }
  }
  return null;
}
