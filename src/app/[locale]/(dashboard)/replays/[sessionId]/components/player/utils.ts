import { RRWEB_EVENT_TYPE } from "@/lib/rrweb-constants";

import type { ConsoleLogEntry, PlayerEvent } from "./types";

const CONSOLE_PLUGIN_NAME = "rrweb/console@1";
const DEFAULT_VIEWPORT = { width: 1920, height: 1080 } as const;

/**
 * rrweb needs `Meta(4)` before `FullSnapshot(2)`. Healthy sessions emit Meta first, but old
 * recordings (before the SDK stamped viewport) start straight at FullSnapshot — synthesise a Meta
 * off the session URL so replay doesn't fall back to a default desktop viewport on mobile data.
 */
export function ensureMetaEvent(
  events: PlayerEvent[],
  sessionUrl: string | null,
  viewport: { width: number | null; height: number | null },
): PlayerEvent[] {
  if (events.length === 0) return events;
  if (events[0]!.type === RRWEB_EVENT_TYPE.Meta) return events;

  let firstRenderIdx = -1;
  for (let i = 0; i < events.length; i++) {
    if (events[i]!.type !== RRWEB_EVENT_TYPE.Custom) {
      firstRenderIdx = i;
      break;
    }
  }
  if (firstRenderIdx === -1) return events;

  const firstRender = events[firstRenderIdx]!;
  if (firstRender.type === RRWEB_EVENT_TYPE.Meta) return events;
  if (firstRender.type !== RRWEB_EVENT_TYPE.FullSnapshot) return events;

  const syntheticMeta: PlayerEvent = {
    type: RRWEB_EVENT_TYPE.Meta,
    timestamp: firstRender.timestamp - 1,
    data: {
      href: sessionUrl ?? "",
      width: viewport.width ?? DEFAULT_VIEWPORT.width,
      height: viewport.height ?? DEFAULT_VIEWPORT.height,
    },
  };
  return [...events.slice(0, firstRenderIdx), syntheticMeta, ...events.slice(firstRenderIdx)];
}

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
    if (event.type !== RRWEB_EVENT_TYPE.Plugin) continue;
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
