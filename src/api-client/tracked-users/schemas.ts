/**
 * Detail parsing lives in `src/server/tracked-users.ts::loadTrackedUserDetail`
 * (shared between the API route handler and the page `HydrationBoundary`
 * prefetch). `traits` stays `z.unknown()`-keyed — customers send any JSON
 * via `Dozor.identify()`, locking the shape down would reject legitimate
 * data; the resolver chain reads specific keys defensively.
 */

import { z } from "zod";

import { cursorPageSchema } from "@/api-client/_lib/pagination";
import { ACTIVITY_RANGES } from "./domain/ranges";
import { USER_LIST_SORT_OPTIONS, SORT_DIRECTIONS, type UserListSortBy, type UserListSortDir } from "./domain/sort";
import { USER_ACTIVITY_STATUSES, type UserActivityStatus } from "./domain/status";

const userActivityStatusSchema = z.enum(USER_ACTIVITY_STATUSES);
const activityRangeSchema = z.enum(ACTIVITY_RANGES);
const traitsSchema = z.record(z.string(), z.unknown()).nullable();

export const trackedUserListItemSchema = z.object({
  id: z.string(),
  externalId: z.string(),
  displayName: z.string(),
  projectId: z.string(),
  projectName: z.string(),
  traits: traitsSchema,
  sessionCount: z.number().int().nonnegative(),
  lastEventAt: z.string().nullable(),
  status: userActivityStatusSchema,
  activeTime7d: z.number().int().nonnegative(),
  createdAt: z.string(),
});

export const trackedUserDetailSchema = trackedUserListItemSchema.extend({
  customName: z.string().nullable(),
  displayNameTraitKey: z.string().nullable(),
  projectDisplayNameTraitKey: z.string().nullable(),
});

export const paginatedTrackedUsersSchema = cursorPageSchema(trackedUserListItemSchema);

export const trackedUsersSummarySchema = z.object({
  total: z.number().int().nonnegative(),
  onlineNow: z.number().int().nonnegative(),
  active24h: z.number().int().nonnegative(),
  newThisWeek: z.number().int().nonnegative(),
});

export const userStatusSchema = z.object({
  online: z.boolean(),
  lastEventAt: z.string().nullable(),
});

export const activityBucketSchema = z.object({
  t: z.string(),
  total: z.number().int().nonnegative(),
  byPage: z.array(
    z.object({
      pathname: z.string(),
      count: z.number().int().nonnegative(),
    }),
  ),
});

export const pageDistributionSchema = z.object({
  pathname: z.string(),
  duration: z.number().nonnegative(),
  share: z.number().min(0).max(1),
  visits: z.number().int().nonnegative(),
});

export const activitySummarySchema = z.object({
  sessionCount: z.number().int().nonnegative(),
  totalActiveTime: z.number().nonnegative(),
  avgSessionDuration: z.number().nonnegative(),
  totalEvents: z.number().int().nonnegative(),
  uniquePages: z.number().int().nonnegative(),
  topPage: z.string().nullable(),
  firstEventAt: z.string().nullable(),
  lastEventAt: z.string().nullable(),
});

export const userActivitySchema = z.object({
  range: activityRangeSchema,
  from: z.string(),
  to: z.string(),
  bucketMs: z.number().int().positive(),
  buckets: z.array(activityBucketSchema),
  pageDistribution: z.array(pageDistributionSchema),
  summary: activitySummarySchema,
});

export const timelinePeriodSchema = z.object({
  url: z.string(),
  pathname: z.string(),
  startedAt: z.string(),
  endedAt: z.string().nullable(),
  duration: z.number().nonnegative(),
});

export const timelineSessionSchema = z.object({
  id: z.string(),
  externalId: z.string(),
  startedAt: z.string(),
  endedAt: z.string().nullable(),
  duration: z.number().nonnegative(),
  url: z.string().nullable(),
  periods: z.array(timelinePeriodSchema),
});

export const userTimelineSchema = z.object({
  range: activityRangeSchema,
  from: z.string(),
  to: z.string(),
  sessions: z.array(timelineSessionSchema),
  pages: z.array(z.string()),
});

/** Isomorphic URL params: server parses inbound, client builds the same shape from `useSearchParams` before pushing. Comma-decoded `projectIds` + `statuses` keep URLs human-readable (`?statuses=ONLINE,ACTIVE_24H`). */
export const userListParamsSchema = z.object({
  search: z.string().trim().optional(),
  projectIds: z
    .string()
    .transform((s) => s.split(",").filter(Boolean))
    .pipe(z.array(z.string().min(1)))
    .optional(),
  statuses: z
    .string()
    .transform((s) => s.split(",").filter(Boolean))
    .pipe(z.array(z.enum(USER_ACTIVITY_STATUSES)))
    .optional(),
  sort: z.enum(USER_LIST_SORT_OPTIONS).optional(),
  sortDir: z.enum(SORT_DIRECTIONS).optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

/**
 * Both fields three-state: omit = leave alone, non-empty string = set, `null` =
 * reset. `.refine` rejects the empty body so a no-op PATCH can't pass silently.
 * `customName` wins over everything; `traitKey` is a key path into the user's
 * traits JSON.
 */
export const updateDisplayNameSchema = z
  .object({
    customName: z
      .union([z.string().trim().min(1, "Custom name cannot be empty").max(120, "Max 120 characters"), z.null()])
      .optional(),
    traitKey: z
      .union([z.string().trim().min(1, "Trait key cannot be empty").max(60, "Max 60 characters"), z.null()])
      .optional(),
  })
  .refine((v) => v.customName !== undefined || v.traitKey !== undefined, {
    message: "At least one of `customName` or `traitKey` must be provided",
  });

/** Pre-serialisation TS shape (not z.infer) — `queries.ts` queryFn and `keys.ts` consume this directly without going through the parser. */
export type TrackedUserListParams = {
  projectIds?: string[];
  statuses?: UserActivityStatus[];
  sort?: UserListSortBy;
  sortDir?: UserListSortDir;
  search?: string;
  cursor?: string;
};

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

export type UpdateDisplayNameInput = z.infer<typeof updateDisplayNameSchema>;
