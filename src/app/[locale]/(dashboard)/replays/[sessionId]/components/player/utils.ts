import type { SessionEvent, SliceInfo } from "@/api-client/sessions/types";
import type { ConsoleLogEntry } from "./types";


const RRWEB_META_TYPE = 4;
const RRWEB_FULL_SNAPSHOT_TYPE = 2;
const EVENT_TYPE_PLUGIN = 6;
const CONSOLE_PLUGIN_NAME = "rrweb/console@1";


/**
 * Ensure slice events start with a Meta event (type 4) before the
 * FullSnapshot (type 2). rrweb Replayer requires Meta → FullSnapshot →
 * Mutations ordering. If the slice events start with a FullSnapshot
 * but no Meta, we synthesize one from the slice's URL and viewport.
 */
export function ensureMetaEvent(events: SessionEvent[], slice: SliceInfo): SessionEvent[] {
  const first = events[0];
  if (!first) return events;
  if (first.type === RRWEB_META_TYPE) return events;

  if (first.type === RRWEB_FULL_SNAPSHOT_TYPE) {
    const syntheticMeta: SessionEvent = {
      type: RRWEB_META_TYPE,
      timestamp: first.timestamp - 1,
      data: {
        href: slice.url,
        width: slice.viewportWidth ?? 1920,
        height: slice.viewportHeight ?? 1080,
      },
    };
    return [syntheticMeta, ...events];
  }

  return events;
}


/** Format milliseconds as MM:SS */
export function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/** Format milliseconds as MM:SS.cc (with centiseconds) */
export function formatTimePrecise(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  const cs = Math.floor((ms % 1000) / 10);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(cs).padStart(2, "0")}`;
}


/**
 * Extract console log entries from rrweb plugin events.
 * Uses the ConsoleLogEntry type from types.ts (single source of truth).
 * Returns entries sorted by timestamp with offsets relative to session start.
 */
export function extractConsoleLogs(events: SessionEvent[]): ConsoleLogEntry[] {
  const firstEvent = events[0];
  if (!firstEvent) return [];

  const sessionStart = firstEvent.timestamp;
  const logs: ConsoleLogEntry[] = [];

  for (const event of events) {
    if (event.type !== EVENT_TYPE_PLUGIN) continue;
    const data = event.data as {
      plugin?: string;
      payload?: { level?: string; payload?: string[]; trace?: string[] };
    };
    if (data.plugin !== CONSOLE_PLUGIN_NAME || !data.payload) continue;

    logs.push({
      timeOffset: event.timestamp - sessionStart,
      level: data.payload.level ?? "log",
      payload: data.payload.payload ?? [],
      trace: data.payload.trace ?? [],
    });
  }

  return logs;
}
