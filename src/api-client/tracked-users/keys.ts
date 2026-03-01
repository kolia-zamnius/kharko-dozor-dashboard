import type { ActivityRange } from "./domain";
import type { TrackedUserListParams } from "./types";

/**
 * Query-key factory for the `tracked-users` feature.
 *
 * @remarks
 * Hierarchical keys — see `src/api-client/user/keys.ts` for the
 * rationale. Shape:
 *
 *   trackedUserKeys.all()                            // ["tracked-users"]
 *   trackedUserKeys.lists()                          // ["tracked-users", "list"]
 *   trackedUserKeys.list(params)                     // ["tracked-users", "list", params]
 *   trackedUserKeys.summary()                        // ["tracked-users", "summary"]
 *   trackedUserKeys.details()                        // ["tracked-users", "detail"]
 *   trackedUserKeys.detail(userId)                   // ["tracked-users", "detail", userId]
 *   trackedUserKeys.forUser(userId)                  // ["tracked-users", "for-user", userId]
 *   trackedUserKeys.sessions(userId, cursor)         // [...forUser(userId), "sessions", cursor]
 *   trackedUserKeys.timeline(userId, range)          // [...forUser(userId), "timeline", range]
 *   trackedUserKeys.activity(userId, range, pageLimit)
 *                                                    // [...forUser(userId), "activity", range, pageLimit]
 *   trackedUserKeys.status(userId)                   // [...forUser(userId), "status"]
 *
 * The `"for-user"` literal prefix inside `forUser(id)` is deliberate
 * — without it, a `userId` that happened to equal the string `"detail"`
 * or `"list"` (vanishingly unlikely with cuids but a real shape-level
 * hazard) would collide with `details()` / `lists()`. The literal
 * marker guarantees user-supplied and vocabulary positions never
 * share a slot.
 *
 * Two useful prefixes for invalidation after an edit mutation:
 *   - `trackedUserKeys.detail(userId)` clears just the detail cache
 *   - `trackedUserKeys.forUser(userId)` clears every per-user sub-query
 *     (sessions, timeline, activity, status) in one shot
 */
export const trackedUserKeys = {
  all: () => ["tracked-users"] as const,

  lists: () => [...trackedUserKeys.all(), "list"] as const,
  list: (params: TrackedUserListParams) => [...trackedUserKeys.lists(), params] as const,

  summary: () => [...trackedUserKeys.all(), "summary"] as const,

  details: () => [...trackedUserKeys.all(), "detail"] as const,
  detail: (userId: string) => [...trackedUserKeys.details(), userId] as const,

  /** Prefix for every per-user sub-query (sessions / timeline / activity / status). */
  forUser: (userId: string) => [...trackedUserKeys.all(), "for-user", userId] as const,
  sessions: (userId: string, cursor: string | undefined) =>
    [...trackedUserKeys.forUser(userId), "sessions", cursor] as const,
  timeline: (userId: string, range: ActivityRange) => [...trackedUserKeys.forUser(userId), "timeline", range] as const,
  activity: (userId: string, range: ActivityRange, pageLimit: number) =>
    [...trackedUserKeys.forUser(userId), "activity", range, pageLimit] as const,
  status: (userId: string) => [...trackedUserKeys.forUser(userId), "status"] as const,
};
