import type { SessionEvent, SliceInfo } from "@/api-client/sessions/types";


/**
 * Discriminated union for the player lifecycle.
 *
 * - "idle"            — no replayer mounted yet (initial / after reset)
 * - "playing"         — actively playing
 * - "paused"          — user-paused or replayer just became ready
 * - "finished"        — playback reached the end, user can replay or switch
 */
export type PlayerState = "idle" | "playing" | "paused" | "finished";


/**
 * Thin interface over the raw rrweb Replayer instance. The Viewport
 * creates the Replayer and exposes this handle upward — consumers
 * (useReplayer, ControlBar) never touch the raw instance directly.
 */
export type ReplayerHandle = {
  play: (timeOffset?: number) => void;
  pause: (timeOffset?: number) => void;
  getCurrentTime: () => number;
  getMetaData: () => { totalTime: number };
  setConfig: (config: { speed?: number; skipInactive?: boolean }) => void;
  on: (event: string, handler: () => void) => void;
};


/**
 * Single console log entry extracted from rrweb plugin events.
 * Single source of truth — consumed by extractConsoleLogs and ConsolePanel.
 */
export type ConsoleLogEntry = {
  /** Milliseconds offset from the first event in the session. */
  timeOffset: number;
  level: string;
  payload: string[];
  trace: string[];
};


export type { SessionEvent, SliceInfo };
