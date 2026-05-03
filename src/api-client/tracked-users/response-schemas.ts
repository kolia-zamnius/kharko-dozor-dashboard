import { z } from "zod";

import { ACTIVITY_RANGES } from "./domain";
import { USER_ACTIVITY_STATUSES } from "./status";

/**
 * Output DTOs — six endpoints (list, summary, detail, activity, status, timeline).
 * For detail, the parse lives inside `src/server/tracked-users.ts::loadTrackedUserDetail`,
 * shared between the API route handler AND the page's `HydrationBoundary` prefetch.
 *
 * `traits` stays `z.record(z.string(), z.unknown()).nullable()` — customers send
 * any JSON shape via `Dozor.identify()`, locking it down would reject legitimate
 * data. The resolver chain reads specific keys defensively.
 */

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

export const paginatedTrackedUsersSchema = z.object({
  data: z.array(trackedUserListItemSchema),
  nextCursor: z.string().nullable(),
});

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

export const timelineSliceSchema = z.object({
  url: z.string(),
  pathname: z.string(),
  reason: z.string(),
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
  slices: z.array(timelineSliceSchema),
});

export const userTimelineSchema = z.object({
  range: activityRangeSchema,
  from: z.string(),
  to: z.string(),
  sessions: z.array(timelineSessionSchema),
  pages: z.array(z.string()),
});
