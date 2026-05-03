import { z } from "zod";

/**
 * Output DTOs. `Slice.reason` narrowed to a closed enum (`init` / `idle` /
 * `navigation`) so ingest + replay can't drift on new values silently.
 * `userTraits` and `SessionEvent.data` stay `z.unknown()` — traits come from
 * customer SDK code (any shape), rrweb event payloads are discriminated by
 * `rrweb.Replayer` and we don't duplicate that contract.
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
