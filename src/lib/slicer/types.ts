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
  // Fallback for the init slice when the rrweb stream starts before any `dozor:url` event —
  // SDK's UrlTracker only fires on navigation, not on session start, so the first pathname
  // would otherwise be `null` until the user navigated. Pass `session.url` here.
  initialUrl?: string | null;
};

export type Slice = {
  // Stable across re-slicing as long as criteria don't change — usable as React key.
  id: string;
  // `null` when neither `initialUrl` was provided nor any url marker has fired yet.
  pathname: string | null;
  url: string | null;
  reason: "init" | "url" | "idle";
  // Unix ms (matches rrweb event.timestamp).
  startedAt: number;
  endedAt: number;
  // Seconds — matches `Session.duration` and the rest of the codebase's `formatDuration` contract.
  duration: number;
  events: DozorEvent[];
};
