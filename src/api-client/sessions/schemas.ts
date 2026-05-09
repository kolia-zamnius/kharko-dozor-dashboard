/**
 * `userTraits`, `Marker.data`, and `EventBatch` payloads stay `z.unknown()` —
 * traits come from customer SDK code (any shape), event blobs are
 * gzip-compressed JSON consumed by rrweb.Replayer client-side, marker
 * payloads are typed per `kind` outside this schema.
 */

import { z } from "zod";

import { cursorPageSchema } from "@/api-client/_lib/pagination";
import { SESSION_DATE_RANGES, type SessionDateRange } from "./domain/ranges";
import {
  SESSION_LIST_SORT_OPTIONS,
  SORT_DIRECTIONS,
  type SessionListSortBy,
  type SessionListSortDir,
} from "./domain/sort";

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

export const paginatedSessionsSchema = cursorPageSchema(sessionListItemSchema);

export const sessionsSummarySchema = z.object({
  totalSessions: z.number().int().nonnegative(),
  totalDuration: z.number().nonnegative(),
  avgDuration: z.number().nonnegative(),
  activeToday: z.number().int().nonnegative(),
});

/** Isomorphic URL params: server parses inbound, client builds the same shape before pushing. Comma-decoded `projectIds` keeps URLs human-readable (`?projectIds=id1,id2`). */
export const sessionListParamsSchema = z.object({
  search: z.string().trim().optional(),
  projectIds: z
    .string()
    .transform((s) => s.split(",").filter(Boolean))
    .pipe(z.array(z.string().min(1)))
    .optional(),
  range: z.enum(SESSION_DATE_RANGES).optional(),
  sort: z.enum(SESSION_LIST_SORT_OPTIONS).optional(),
  sortDir: z.enum(SORT_DIRECTIONS).optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

/** Pre-serialisation TS shape (not z.infer) — `queries.ts` queryFn and `keys.ts` consume this directly without going through the parser. */
export type SessionListParams = {
  projectIds?: string[];
  search?: string;
  sort?: SessionListSortBy;
  sortDir?: SessionListSortDir;
  range?: SessionDateRange;
  cursor?: string;
};

export type SessionListItem = z.infer<typeof sessionListItemSchema>;
export type SessionDetail = z.infer<typeof sessionDetailSchema>;
export type Marker = z.infer<typeof markerSchema>;
export type EventBatchEnvelope = z.infer<typeof eventBatchEnvelopeSchema>;
export type SessionEventsResponse = z.infer<typeof sessionEventsResponseSchema>;
export type SessionMarkersResponse = z.infer<typeof sessionMarkersResponseSchema>;
export type PaginatedSessions = z.infer<typeof paginatedSessionsSchema>;
export type SessionsSummary = z.infer<typeof sessionsSummarySchema>;
export type SessionListParamsInput = z.infer<typeof sessionListParamsSchema>;
