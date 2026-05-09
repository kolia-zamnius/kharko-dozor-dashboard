import type { SessionListParams } from "./schemas";

/**
 * Invalidating `detail(sessionId)` cascades to `events` + `markers` via
 * TanStack prefix-match. The extra `"list"` level isolates list invalidation —
 * `lists()` nukes every filter / sort combo without touching `details()`.
 */
export const sessionKeys = {
  all: () => ["sessions"] as const,

  lists: () => [...sessionKeys.all(), "list"] as const,
  list: (params: SessionListParams) => [...sessionKeys.lists(), params] as const,

  summary: () => [...sessionKeys.all(), "summary"] as const,

  details: () => [...sessionKeys.all(), "detail"] as const,
  detail: (sessionId: string) => [...sessionKeys.details(), sessionId] as const,

  events: (sessionId: string) => [...sessionKeys.detail(sessionId), "events"] as const,
  markers: (sessionId: string) => [...sessionKeys.detail(sessionId), "markers"] as const,
};
