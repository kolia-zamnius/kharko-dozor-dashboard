/**
 * Mirrors rrweb's `eventWithTime` — re-declared here so this module is server-safe (no rrweb pull-in).
 */
export type DozorEvent = {
  type: number;
  timestamp: number;
  data: unknown;
};

/**
 * Sections (`init`, `navigation`) chain head-to-tail; markers (`idle`, `identify`) nest inside.
 *
 * `startedAt` / `endedAt` live in the active playback timeline (compressed when idle compression
 * is on, raw otherwise). `realDurationMs` always carries the original ms gap — that's the value
 * UI labels show, so a 1 h idle compressed to a 5 s blip still reads "59m 50s" in the feed.
 */
type HistoryItemBase = {
  id: string;
  startedAt: number;
  endedAt: number;
  realDurationMs: number;
};

export type HistoryItem =
  | (HistoryItemBase & { kind: "init"; pathname: string | null; url: string | null })
  | (HistoryItemBase & { kind: "navigation"; pathname: string; url: string })
  | (HistoryItemBase & { kind: "idle" })
  | (HistoryItemBase & { kind: "identify"; userId: string; traits: Record<string, unknown> | null });

export type HistoryItemKind = HistoryItem["kind"];

export type HistoryCriteria = {
  /** Ms between consecutive events that flags an idle marker. `null` disables idle detection. */
  idleGapMs: number | null;
  /** Fallback URL for the init section when the stream starts before any `dozor:url` event. */
  initialUrl?: string | null;
  /** Closes the trailing section. Omit for live sessions — falls back to last event's timestamp. */
  sessionEndedAt?: number;
};
