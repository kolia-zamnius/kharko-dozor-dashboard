import { z } from "zod";

/**
 * Output DTOs. `userTraits`, `Marker.data`, and `EventBatch` payloads stay
 * `z.unknown()` — traits come from customer SDK code (any shape), event blobs
 * are gzip-compressed JSON consumed by rrweb.Replayer client-side, marker
 * payloads are typed per `kind` outside this schema.
 */

export const markerSchema = z.object({
  timestamp: z.number(),
  kind: z.string(),
  data: z.unknown(),
});

export const eventBatchEnvelopeSchema = z.object({
  id: z.string(),
  firstTimestamp: z.number(),
  lastTimestamp: z.number(),
  eventCount: z.number().int().nonnegative(),
  /** Base64-encoded gzip blob — client decompresses via `DecompressionStream`. */
  data: z.string(),
});

export const sessionEventsResponseSchema = z.object({
  batches: z.array(eventBatchEnvelopeSchema),
  nextCursor: z.string().nullable(),
});

export const sessionMarkersResponseSchema = z.object({
  markers: z.array(markerSchema),
});

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
  markers: z.array(markerSchema),
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
