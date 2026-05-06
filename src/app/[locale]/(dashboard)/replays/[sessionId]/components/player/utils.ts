import type { Slice } from "@/lib/slicer/types";
import type { ConsoleLogEntry, PlayerEvent } from "./types";

const RRWEB_META_TYPE = 4;
const RRWEB_FULL_SNAPSHOT_TYPE = 2;
const RRWEB_CUSTOM_TYPE = 5;
const EVENT_TYPE_PLUGIN = 6;
const CONSOLE_PLUGIN_NAME = "rrweb/console@1";
// Fallback only when the session was recorded before Dozor stamped viewport — never the active path.
const DEFAULT_VIEWPORT = { width: 1920, height: 1080 } as const;

// rrweb requires Meta(4) → FullSnapshot(2) → Mutations ordering. URL-cut slices
// start with the `dozor:url` Custom event and the FullSnapshot lands at index
// 1+, so we scan past leading Custom events before deciding to synthesise.
// Without this, rrweb falls back to a default viewport and stretches mobile
// recordings to desktop.
export function ensureMetaEvent(
  events: PlayerEvent[],
  slice: Slice,
  viewport: { width: number | null; height: number | null },
): PlayerEvent[] {
  if (events.length === 0) return events;
  if (events[0]!.type === RRWEB_META_TYPE) return events;

  let firstRenderIdx = -1;
  for (let i = 0; i < events.length; i++) {
    if (events[i]!.type !== RRWEB_CUSTOM_TYPE) {
      firstRenderIdx = i;
      break;
    }
  }
  if (firstRenderIdx === -1) return events;

  const firstRender = events[firstRenderIdx]!;
  if (firstRender.type === RRWEB_META_TYPE) return events;
  if (firstRender.type !== RRWEB_FULL_SNAPSHOT_TYPE) return events;

  const syntheticMeta: PlayerEvent = {
    type: RRWEB_META_TYPE,
    timestamp: firstRender.timestamp - 1,
    data: {
      href: slice.url ?? "",
      width: viewport.width ?? DEFAULT_VIEWPORT.width,
      height: viewport.height ?? DEFAULT_VIEWPORT.height,
    },
  };
  return [...events.slice(0, firstRenderIdx), syntheticMeta, ...events.slice(firstRenderIdx)];
}

// Browser `DecompressionStream` ships in every target — no polyfill needed.
export async function decompressBatch(base64Data: string): Promise<PlayerEvent[]> {
  if (base64Data.length === 0) return [];

  const binary = atob(base64Data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
  const text = await new Response(stream).text();
  return JSON.parse(text) as PlayerEvent[];
}

export function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

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
