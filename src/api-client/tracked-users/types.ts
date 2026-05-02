import type { z } from "zod";

import type { UserListSortBy, UserListSortDir } from "./domain";
import type {
  activityBucketSchema,
  activitySummarySchema,
  pageDistributionSchema,
  paginatedTrackedUsersSchema,
  timelineSessionSchema,
  timelineSliceSchema,
  trackedUserDetailSchema,
  trackedUserListItemSchema,
  trackedUsersSummarySchema,
  userActivitySchema,
  userStatusSchema,
  userTimelineSchema,
} from "./response-schemas";
import type { UserActivityStatus } from "./status";

/**
 * Type barrel for the `tracked-users` feature. Response DTOs are
 * inferred from zod schemas in `response-schemas.ts`; request-side
 * list params stay here as a plain type because they don't ride the
 * wire as a JSON body (they're parsed from `URLSearchParams` via
 * `validators.ts::userListParamsSchema`).
 */


export type TrackedUserListItem = z.infer<typeof trackedUserListItemSchema>;
export type TrackedUserDetail = z.infer<typeof trackedUserDetailSchema>;
export type PaginatedTrackedUsers = z.infer<typeof paginatedTrackedUsersSchema>;
export type TrackedUsersSummary = z.infer<typeof trackedUsersSummarySchema>;

export type UserStatus = z.infer<typeof userStatusSchema>;

export type ActivityBucket = z.infer<typeof activityBucketSchema>;
export type PageDistribution = z.infer<typeof pageDistributionSchema>;
export type ActivitySummary = z.infer<typeof activitySummarySchema>;
export type UserActivity = z.infer<typeof userActivitySchema>;

export type TimelineSlice = z.infer<typeof timelineSliceSchema>;
export type TimelineSession = z.infer<typeof timelineSessionSchema>;
export type UserTimeline = z.infer<typeof userTimelineSchema>;

// Shared between `queries.ts` (query fn) and `keys.ts` (cache key).

export type TrackedUserListParams = {
  projectIds?: string[];
  statuses?: UserActivityStatus[];
  sort?: UserListSortBy;
  sortDir?: UserListSortDir;
  search?: string;
  cursor?: string;
};
