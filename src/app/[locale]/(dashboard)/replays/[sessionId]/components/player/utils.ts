import type { Slice } from "@/lib/slicer/types";
import type { ConsoleLogEntry, PlayerEvent } from "./types";

const RRWEB_META_TYPE = 4;
const RRWEB_FULL_SNAPSHOT_TYPE = 2;
const EVENT_TYPE_PLUGIN = 6;
const CONSOLE_PLUGIN_NAME = "rrweb/console@1";

// rrweb requires Meta(4) → FullSnapshot(2) → Mutations ordering. When a slice
// starts at a FullSnapshot we synthesise a Meta event from the slice's url so
// the Replayer renders the correct viewport on jump-in.
export function ensureMetaEvent(events: PlayerEvent[], slice: Slice): PlayerEvent[] {
  const first = events[0];
  if (!first) return events;
  if (first.type === RRWEB_META_TYPE) return events;

  if (first.type === RRWEB_FULL_SNAPSHOT_TYPE) {
    const syntheticMeta: PlayerEvent = {
      type: RRWEB_META_TYPE,
      timestamp: first.timestamp - 1,
      data: {
        href: slice.url ?? "",
        width: 1920,
        height: 1080,
      },
    };
    return [syntheticMeta, ...events];
  }

  return events;
}

// Decompresses a base64-gzip envelope payload into a typed event array. Browser
// `DecompressionStream` is a Web Streams API, available in every target browser.
export async function decompressBatch(base64Data: string): Promise<PlayerEvent[]> {
  if (base64Data.length === 0) return [];

  const binary = atob(base64Data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
  const text = await new Response(stream).text();
  return JSON.parse(text) as PlayerEvent[];
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

export function extractConsoleLogs(events: PlayerEvent[]): ConsoleLogEntry[] {
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
