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
// Single linear pass: track running URL while collecting splits, so a session with N events
// stays O(N) instead of the O(N²) shape that nested per-slice url lookups would produce.
export function slice(events: readonly DozorEvent[], criteria: SlicingCriteria): Slice[] {
  if (events.length === 0) return [];

  const sorted = [...events].sort((a, b) => a.timestamp - b.timestamp);
  type SplitMeta = { index: number; reason: "init" | "url" | "idle"; url: string | null; pathname: string | null };
  const splits: SplitMeta[] = [];
  // Seed from `initialUrl` so the init slice has a pathname even before the first navigation.
  let runningUrl: string | null = criteria.initialUrl ?? null;
  let runningPathname: string | null = derivePathname(runningUrl);

  for (let i = 0; i < sorted.length; i++) {
    const event = sorted[i]!;

    if (isUrlMarker(event)) {
      const payload = event.data.payload;
      if (typeof payload.url === "string") runningUrl = payload.url;
      if (typeof payload.pathname === "string") runningPathname = payload.pathname;
    }

    if (i === 0) {
      splits.push({ index: 0, reason: "init", url: runningUrl, pathname: runningPathname });
      continue;
    }

    if (criteria.byUrl && isUrlMarker(event)) {
      splits.push({ index: i, reason: "url", url: runningUrl, pathname: runningPathname });
      continue;
    }

    if (criteria.idleGapMs !== null) {
      const prev = sorted[i - 1]!;
      if (event.timestamp - prev.timestamp > criteria.idleGapMs) {
        splits.push({ index: i, reason: "idle", url: runningUrl, pathname: runningPathname });
      }
    }
  }

  const out: Slice[] = [];
  for (let s = 0; s < splits.length; s++) {
    const meta = splits[s]!;
    const startIdx = meta.index;
    const endIdx = s + 1 < splits.length ? splits[s + 1]!.index : sorted.length;
    const sliceEvents = sorted.slice(startIdx, endIdx);
    const first = sliceEvents[0]!;
    const last = sliceEvents[sliceEvents.length - 1]!;

    out.push({
      id: `${first.timestamp}-${s}`,
      pathname: meta.pathname,
      url: meta.url,
      reason: meta.reason,
      startedAt: first.timestamp,
      endedAt: last.timestamp,
      duration: Math.round((last.timestamp - first.timestamp) / 1000),
      events: sliceEvents,
    });
  }

  return out;
}

function derivePathname(url: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).pathname;
  } catch {
    return null;
  }
}
