export type DozorEvent = {
  type: number;
  timestamp: number;
  data: unknown;
};

export type SlicingCriteria = {
  // Splits at every `dozor:url` custom-event marker found in the stream.
  byUrl: boolean;
  // ms between consecutive events that triggers a split. `null` disables idle-based splitting.
  idleGapMs: number | null;
};

export type Slice = {
  // Stable across re-slicing as long as criteria don't change — usable as React key.
  id: string;
  // `null` when no url marker has fired yet (sessions that started before any pathname was captured).
  pathname: string | null;
  url: string | null;
  reason: "init" | "url" | "idle";
  // Unix ms (matches rrweb event.timestamp).
  startedAt: number;
  endedAt: number;
  duration: number;
  events: DozorEvent[];
};
