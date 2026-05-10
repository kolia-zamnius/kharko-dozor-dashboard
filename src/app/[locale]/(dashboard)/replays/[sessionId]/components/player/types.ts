import type { DozorEvent, HistoryItem } from "@/lib/history/types";

/** `idle` = no replayer (initial / post-reset); `paused` = either user-paused or just-ready. */
export type PlayerState = "idle" | "playing" | "paused" | "finished";

export const PLAYER_TABS = ["history", "console"] as const;
export type PlayerTab = (typeof PLAYER_TABS)[number];

export function isPlayerTab(value: string): value is PlayerTab {
  return (PLAYER_TABS as readonly string[]).includes(value);
}

/** Thin facade over the rrweb Replayer — Viewport creates it, consumers only get this handle. */
export type ReplayerHandle = {
  play: (timeOffset?: number) => void;
  pause: (timeOffset?: number) => void;
  getCurrentTime: () => number;
  getMetaData: () => { totalTime: number };
  setConfig: (config: { speed?: number; skipInactive?: boolean }) => void;
  on: (event: string, handler: () => void) => void;
};

export type ConsoleLogEntry = {
  /** Ms offset from the first event in the session. */
  timeOffset: number;
  level: string;
  payload: string[];
  trace: string[];
};

export type PlayerEvent = DozorEvent;

export type { HistoryItem };
