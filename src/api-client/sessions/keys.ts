import type { SessionListParams } from "./types";

// Extra `"list"` level isolates list invalidation — `lists()` nukes every
// filter / sort combo without touching `details()` or events caches.
export const sessionKeys = {
  all: () => ["sessions"] as const,

  lists: () => [...sessionKeys.all(), "list"] as const,
  list: (params: SessionListParams) => [...sessionKeys.lists(), params] as const,

  summary: () => [...sessionKeys.all(), "summary"] as const,

  details: () => [...sessionKeys.all(), "detail"] as const,
  detail: (sessionId: string) => [...sessionKeys.details(), sessionId] as const,

  events: (sessionId: string) => [...sessionKeys.all(), "events", sessionId] as const,
  markers: (sessionId: string) => [...sessionKeys.all(), "markers", sessionId] as const,
};
