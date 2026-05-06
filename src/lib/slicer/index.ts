import type { DozorEvent, Slice, SlicingCriteria } from "./types";

const RRWEB_CUSTOM_TYPE = 5;
const URL_TAG = "dozor:url";

type UrlMarkerData = { tag: string; payload: { url?: string; pathname?: string } };

function isUrlMarker(event: DozorEvent): event is DozorEvent & { data: UrlMarkerData } {
  if (event.type !== RRWEB_CUSTOM_TYPE) return false;
  const data = event.data as { tag?: unknown } | null;
  return !!data && data.tag === URL_TAG;
}

// Pure — caller controls memoisation. `events` may be unsorted; we copy + sort defensively.
export function slice(events: readonly DozorEvent[], criteria: SlicingCriteria): Slice[] {
  if (events.length === 0) return [];

  const sorted = [...events].sort((a, b) => a.timestamp - b.timestamp);
  const splits: Array<{ index: number; reason: "init" | "url" | "idle" }> = [{ index: 0, reason: "init" }];

  for (let i = 0; i < sorted.length; i++) {
    const event = sorted[i]!;

    if (criteria.byUrl && i > 0 && isUrlMarker(event)) {
      splits.push({ index: i, reason: "url" });
      continue;
    }

    if (criteria.idleGapMs !== null && i > 0) {
      const prev = sorted[i - 1]!;
      const gap = event.timestamp - prev.timestamp;
      if (gap > criteria.idleGapMs) {
        splits.push({ index: i, reason: "idle" });
      }
    }
  }

  // Pre-scan url markers so each slice can advertise the pathname active at its start
  // even when the slicer wasn't asked to split on URL.
  const urlAt = (timestamp: number): { url: string | null; pathname: string | null } => {
    let lastUrl: string | null = null;
    let lastPathname: string | null = null;
    for (const e of sorted) {
      if (e.timestamp > timestamp) break;
      if (isUrlMarker(e)) {
        const payload = (e.data as UrlMarkerData).payload;
        if (typeof payload.url === "string") lastUrl = payload.url;
        if (typeof payload.pathname === "string") lastPathname = payload.pathname;
      }
    }
    return { url: lastUrl, pathname: lastPathname };
  };

  const out: Slice[] = [];
  for (let s = 0; s < splits.length; s++) {
    const startIdx = splits[s]!.index;
    const endIdx = s + 1 < splits.length ? splits[s + 1]!.index : sorted.length;
    const sliceEvents = sorted.slice(startIdx, endIdx);
    const first = sliceEvents[0]!;
    const last = sliceEvents[sliceEvents.length - 1]!;
    const { url, pathname } = urlAt(first.timestamp);

    out.push({
      id: `${first.timestamp}-${s}`,
      pathname,
      url,
      reason: splits[s]!.reason,
      startedAt: first.timestamp,
      endedAt: last.timestamp,
      duration: last.timestamp - first.timestamp,
      events: sliceEvents,
    });
  }

  return out;
}
