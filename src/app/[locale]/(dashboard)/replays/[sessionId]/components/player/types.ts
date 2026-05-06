import type { Slice } from "@/lib/slicer/types";

/** `idle` = no replayer (initial/post-reset); `paused` = either user-paused or just-ready. */
export type PlayerState = "idle" | "playing" | "paused" | "finished";

/** Thin interface over the raw rrweb Replayer — Viewport creates it, consumers only get this handle. */
export type ReplayerHandle = {
  play: (timeOffset?: number) => void;
  pause: (timeOffset?: number) => void;
  getCurrentTime: () => number;
  getMetaData: () => { totalTime: number };
  setConfig: (config: { speed?: number; skipInactive?: boolean }) => void;
  on: (event: string, handler: () => void) => void;
};

export type ConsoleLogEntry = {
  /** ms offset from the first event in the session. */
  timeOffset: number;
  level: string;
  payload: string[];
  trace: string[];
};

export type PlayerEvent = {
  type: number;
  timestamp: number;
  data: unknown;
};

export type { Slice };
