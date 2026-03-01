import { z } from "zod";

import { ACTIVITY_RANGES } from "./domain";
import { USER_ACTIVITY_STATUSES } from "./status";

/**
 * Response DTO schemas for the `tracked-users` feature — biggest
 * schema module in the repo, covering six endpoints: list, summary,
 * detail, activity (histogram + pages + KPIs), status, timeline.
 *
 * @remarks
 * Twin of `validators.ts` (inputs). Every JSON response from
 * `src/app/api/tracked-users/**` parses through one of these before
 * `NextResponse.json`. For the detail endpoint the guard additionally
 * lives inside `src/server/tracked-users.ts::loadTrackedUserDetail`,
 * which is shared between the API route handler AND the page's
 * `HydrationBoundary` prefetch — parsing in the loader means both
 * paths hit the same validator.
 *
 * `traits` is typed as `z.record(z.string(), z.unknown()).nullable()`
 * because the SDK lets customers send any JSON shape via
 * `Dozor.identify(traits)`. We deliberately don't narrow further —
 * the resolver chain (`resolveDisplayName`) reads specific keys
 * defensively, and locking the schema down would reject legitimate
 * customer data.
 *
 * @see src/api-client/tracked-users/validators.ts — request-side schemas.
 * @see src/server/tracked-users.ts — shared loader that parses detail.
 */

// ── Shared primitives ──────────────────────────────────────────────────

const userActivityStatusSchema = z.enum(USER_ACTIVITY_STATUSES);
const activityRangeSchema = z.enum(ACTIVITY_RANGES);
const traitsSchema = z.record(z.string(), z.unknown()).nullable();

// ── List + detail ──────────────────────────────────────────────────────

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

// ── Summary (stats strip) ──────────────────────────────────────────────

export const trackedUsersSummarySchema = z.object({
  total: z.number().int().nonnegative(),
  onlineNow: z.number().int().nonnegative(),
  active24h: z.number().int().nonnegative(),
  newThisWeek: z.number().int().nonnegative(),
});

// ── Online-status heartbeat ────────────────────────────────────────────

export const userStatusSchema = z.object({
  online: z.boolean(),
  lastEventAt: z.string().nullable(),
});

// ── Activity — histogram buckets + page distribution + KPI summary ─────

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

// ── Timeline (sessions + slices in a window) ───────────────────────────

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
