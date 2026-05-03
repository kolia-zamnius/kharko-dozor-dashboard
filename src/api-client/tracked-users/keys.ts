import type { ActivityRange } from "./domain";
import type { TrackedUserListParams } from "./types";

/**
 * The literal `"for-user"` prefix in `forUser(id)` is deliberate — without it,
 * a `userId` that happened to equal `"detail"` or `"list"` (vanishingly unlikely
 * with cuids but a real shape-level hazard) would collide with `details()` /
 * `lists()`. Two useful invalidation prefixes after an edit:
 * `detail(userId)` clears just the detail cache; `forUser(userId)` clears every
 * per-user sub-query (sessions, timeline, activity, status) in one shot.
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
