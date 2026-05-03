import type { SessionListParams } from "./types";

/**
 * Extra `"list"` level isolates list invalidation — `lists()` nukes every
 * filter / sort combo without touching `details()` or slice-event caches.
 * `SessionListParams` is imported from `./types` so the same shape feeds the
 * `queryFn` in `queries.ts` and the cache key here.
 */
export const sessionKeys = {
  all: () => ["sessions"] as const,

  lists: () => [...sessionKeys.all(), "list"] as const,
  list: (params: SessionListParams) => [...sessionKeys.lists(), params] as const,

  summary: () => [...sessionKeys.all(), "summary"] as const,

  details: () => [...sessionKeys.all(), "detail"] as const,
  detail: (sessionId: string) => [...sessionKeys.details(), sessionId] as const,

  /** Invalidate across all slice indices for one session — e.g. after a snapshot bump. */
  sliceEventsBySession: (sessionId: string) => [...sessionKeys.all(), "sliceEvents", sessionId] as const,
  sliceEvents: (sessionId: string, sliceIndex: number) =>
    [...sessionKeys.sliceEventsBySession(sessionId), sliceIndex] as const,
};
