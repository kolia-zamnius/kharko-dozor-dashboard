import type { ActivityRange } from "./domain/ranges";
import type { TrackedUserListParams } from "./schemas";

/**
 * `detail(userId)` invalidation cascades to every per-user sub-query
 * (sessions, timeline, activity, status) via TanStack prefix-match. A
 * `userId` colliding with the literal `"sessions"` / `"timeline"` would
 * conflate caches — CUIDs make that vanishingly improbable.
 */
export const trackedUserKeys = {
  all: () => ["tracked-users"] as const,

  lists: () => [...trackedUserKeys.all(), "list"] as const,
  list: (params: TrackedUserListParams) => [...trackedUserKeys.lists(), params] as const,

  summary: () => [...trackedUserKeys.all(), "summary"] as const,

  details: () => [...trackedUserKeys.all(), "detail"] as const,
  detail: (userId: string) => [...trackedUserKeys.details(), userId] as const,

  sessions: (userId: string, cursor: string | undefined) =>
    [...trackedUserKeys.detail(userId), "sessions", cursor] as const,
  timeline: (userId: string, range: ActivityRange) => [...trackedUserKeys.detail(userId), "timeline", range] as const,
  activity: (userId: string, range: ActivityRange, pageLimit: number) =>
    [...trackedUserKeys.detail(userId), "activity", range, pageLimit] as const,
  status: (userId: string) => [...trackedUserKeys.detail(userId), "status"] as const,
};
