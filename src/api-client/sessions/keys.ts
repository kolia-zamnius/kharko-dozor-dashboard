import type { SessionListParams } from "./types";

/**
 * Query-key factory for the `sessions` feature.
 *
 * @remarks
 * Hierarchical keys — see `src/api-client/user/keys.ts` for the
 * rationale. Shape:
 *
 *   sessionKeys.all()                         // ["sessions"]
 *   sessionKeys.lists()                       // ["sessions", "list"]
 *   sessionKeys.list(params)                  // ["sessions", "list", params]
 *   sessionKeys.summary()                     // ["sessions", "summary"]
 *   sessionKeys.details()                     // ["sessions", "detail"]
 *   sessionKeys.detail(id)                    // ["sessions", "detail", id]
 *   sessionKeys.sliceEvents(id, idx)          // ["sessions", "sliceEvents", id, idx]
 *
 * The extra `"list"` level (instead of `["sessions", params]` directly)
 * isolates list invalidation — `sessionKeys.lists()` nukes every
 * filter / sort combo without touching details or slice-event caches.
 *
 * The `SessionListParams` type is imported from `./types` so the same
 * shape feeds both the `queryFn` in `queries.ts` and the cache key
 * here — a rename in one place refactors every caller at once.
 */
export const sessionKeys = {
  all: () => ["sessions"] as const,

  lists: () => [...sessionKeys.all(), "list"] as const,
  list: (params: SessionListParams) => [...sessionKeys.lists(), params] as const,

  summary: () => [...sessionKeys.all(), "summary"] as const,

  details: () => [...sessionKeys.all(), "detail"] as const,
  detail: (sessionId: string) => [...sessionKeys.details(), sessionId] as const,

  /** Every slice-events cache for a single session — used to invalidate
   *  across slice indices when the session snapshot bumps. */
  sliceEventsBySession: (sessionId: string) => [...sessionKeys.all(), "sliceEvents", sessionId] as const,
  sliceEvents: (sessionId: string, sliceIndex: number) =>
    [...sessionKeys.sliceEventsBySession(sessionId), sliceIndex] as const,
};
