import type { z } from "zod";

import type { UserListSortBy, UserListSortDir } from "./domain";
import type {
  activityBucketSchema,
  activitySummarySchema,
  pageDistributionSchema,
  paginatedTrackedUsersSchema,
  timelinePeriodSchema,
  timelineSessionSchema,
  trackedUserDetailSchema,
  trackedUserListItemSchema,
  trackedUsersSummarySchema,
  userActivitySchema,
  userStatusSchema,
  userTimelineSchema,
} from "./response-schemas";
import type { UserActivityStatus } from "./status";

export type TrackedUserListItem = z.infer<typeof trackedUserListItemSchema>;
export type TrackedUserDetail = z.infer<typeof trackedUserDetailSchema>;
export type PaginatedTrackedUsers = z.infer<typeof paginatedTrackedUsersSchema>;
export type TrackedUsersSummary = z.infer<typeof trackedUsersSummarySchema>;

export type UserStatus = z.infer<typeof userStatusSchema>;

export type ActivityBucket = z.infer<typeof activityBucketSchema>;
export type PageDistribution = z.infer<typeof pageDistributionSchema>;
export type ActivitySummary = z.infer<typeof activitySummarySchema>;
export type UserActivity = z.infer<typeof userActivitySchema>;

export type TimelinePeriod = z.infer<typeof timelinePeriodSchema>;
export type TimelineSession = z.infer<typeof timelineSessionSchema>;
export type UserTimeline = z.infer<typeof userTimelineSchema>;

/** Plain type (URL params) shared between `queries.ts` queryFn and `keys.ts` cache key. */
export type TrackedUserListParams = {
  projectIds?: string[];
  statuses?: UserActivityStatus[];
  sort?: UserListSortBy;
  sortDir?: UserListSortDir;
  search?: string;
  cursor?: string;
};
