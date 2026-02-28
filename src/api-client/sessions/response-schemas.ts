import { z } from "zod";

/**
 * Response DTO schemas for the `sessions` feature — covers list,
 * detail, summary, and per-slice event stream.
 *
 * @remarks
 * Twin of `validators.ts` (inputs). Two notable shape decisions:
 *
 *   - `Slice.reason` is narrowed to the closed enum `"init" | "idle"
 *      | "navigation"` at the wire layer even though the DB column is
 *      `String`. New reason values must be added here explicitly, so
 *      the ingest schema + the replay slice picker can't drift apart
 *      silently.
 *   - `userTraits` is `z.record(z.string(), z.unknown()).nullable()`
 *      — same rationale as in `tracked-users/response-schemas.ts`:
 *      traits are customer-supplied JSON and we refuse to lock the
 *      shape down beyond "object or null".
 *
 * `SessionEvent.data` is `z.unknown()` — these are raw rrweb payloads
 * whose shape varies by event type. The replay viewer hands them
 * straight to `rrweb.Replayer` which does its own discriminated
 * parsing; we refuse to duplicate that contract on our side.
 *
 * @see src/api-client/sessions/validators.ts — request-side schemas.
 */

export const sliceInfoSchema = z.object({
  id: z.string(),
  index: z.number().int().nonnegative(),
  reason: z.enum(["init", "idle", "navigation"]),
  pathname: z.string(),
  url: z.string(),
  viewportWidth: z.number().int().positive().nullable(),
  viewportHeight: z.number().int().positive().nullable(),
  startedAt: z.string(),
  endedAt: z.string().nullable(),
  duration: z.number().nonnegative(),
  eventCount: z.number().int().nonnegative(),
});

export const sessionEventSchema = z.object({
  type: z.number().int(),
  timestamp: z.number(),
  data: z.unknown(),
});

export const sessionEventListSchema = z.array(sessionEventSchema);

export const sessionListItemSchema = z.object({
  id: z.string(),
  externalId: z.string(),
  projectId: z.string(),
  projectName: z.string(),
  url: z.string().nullable(),
  duration: z.number().nonnegative(),
  eventCount: z.number().int().nonnegative(),
  createdAt: z.string(),
  trackedUserId: z.string().nullable(),
  userId: z.string().nullable(),
  userDisplayName: z.string().nullable(),
  userTraits: z.record(z.string(), z.unknown()).nullable(),
  sliceCount: z.number().int().nonnegative(),
});

export const sessionDetailSchema = z.object({
  id: z.string(),
  externalId: z.string(),
  projectId: z.string(),
  projectName: z.string(),
  url: z.string().nullable(),
  userAgent: z.string().nullable(),
  screenWidth: z.number().int().positive().nullable(),
  screenHeight: z.number().int().positive().nullable(),
  language: z.string().nullable(),
  duration: z.number().nonnegative(),
  eventCount: z.number().int().nonnegative(),
  startedAt: z.string(),
  endedAt: z.string().nullable(),
  createdAt: z.string(),
  trackedUserId: z.string().nullable(),
  userId: z.string().nullable(),
  userTraits: z.record(z.string(), z.unknown()).nullable(),
  events: z.array(sessionEventSchema),
  slices: z.array(sliceInfoSchema),
});

export const paginatedSessionsSchema = z.object({
  data: z.array(sessionListItemSchema),
  nextCursor: z.string().nullable(),
});

export const sessionsSummarySchema = z.object({
  totalSessions: z.number().int().nonnegative(),
  totalDuration: z.number().nonnegative(),
  avgDuration: z.number().nonnegative(),
  activeToday: z.number().int().nonnegative(),
});
