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

/**
 * Type barrel for the `sessions` feature. Response DTOs are inferred
 * from zod schemas in `response-schemas.ts`; request-side list params
 * stay here as a plain type (they're parsed from `URLSearchParams`
 * via `validators.ts::sessionListParamsSchema`, not a JSON body).
 */


export type SessionListItem = z.infer<typeof sessionListItemSchema>;
export type SliceInfo = z.infer<typeof sliceInfoSchema>;
export type SessionDetail = z.infer<typeof sessionDetailSchema>;
export type SessionEvent = z.infer<typeof sessionEventSchema>;
export type PaginatedSessions = z.infer<typeof paginatedSessionsSchema>;
export type SessionsSummary = z.infer<typeof sessionsSummarySchema>;

// Separated from response DTOs above but kept in the same file: list
// params are shared between `queries.ts` (query fn) and `keys.ts` (cache
// key) — keeping them here avoids a cycle if `keys.ts` ever also needs
// response types (e.g. for typed `setQueryData` helpers).

export type SessionListParams = {
  projectIds?: string[];
  search?: string;
  sort?: SessionListSortBy;
  sortDir?: SessionListSortDir;
  range?: SessionDateRange;
  cursor?: string;
};
