import type { z } from "zod";

import type { SessionDateRange, SessionListSortBy, SessionListSortDir } from "./domain";
import type {
  eventBatchEnvelopeSchema,
  markerSchema,
  paginatedSessionsSchema,
  sessionDetailSchema,
  sessionEventsResponseSchema,
  sessionListItemSchema,
  sessionMarkersResponseSchema,
  sessionsSummarySchema,
} from "./response-schemas";

export type SessionListItem = z.infer<typeof sessionListItemSchema>;
export type SessionDetail = z.infer<typeof sessionDetailSchema>;
export type Marker = z.infer<typeof markerSchema>;
export type EventBatchEnvelope = z.infer<typeof eventBatchEnvelopeSchema>;
export type SessionEventsResponse = z.infer<typeof sessionEventsResponseSchema>;
export type SessionMarkersResponse = z.infer<typeof sessionMarkersResponseSchema>;
export type PaginatedSessions = z.infer<typeof paginatedSessionsSchema>;
export type SessionsSummary = z.infer<typeof sessionsSummarySchema>;

/** Plain type (URL params, not a JSON body) shared between `queries.ts` queryFn and `keys.ts` cache key. */
export type SessionListParams = {
  projectIds?: string[];
  search?: string;
  sort?: SessionListSortBy;
  sortDir?: SessionListSortDir;
  range?: SessionDateRange;
  cursor?: string;
};
