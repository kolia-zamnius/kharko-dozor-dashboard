import type { z } from "zod";

import type { SessionDateRange, SessionListSortBy, SessionListSortDir } from "./domain";
import type {
  paginatedSessionsSchema,
  sessionDetailSchema,
  sessionEventSchema,
  sessionListItemSchema,
  sessionsSummarySchema,
  sliceInfoSchema,
} from "./response-schemas";

export type SessionListItem = z.infer<typeof sessionListItemSchema>;
export type SliceInfo = z.infer<typeof sliceInfoSchema>;
export type SessionDetail = z.infer<typeof sessionDetailSchema>;
export type SessionEvent = z.infer<typeof sessionEventSchema>;
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
