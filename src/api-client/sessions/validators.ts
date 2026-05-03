import { z } from "zod";
import { SESSION_LIST_SORT_OPTIONS, SORT_DIRECTIONS } from "./domain";
import { SESSION_DATE_RANGES } from "./domain";

/**
 * Used isomorphically — server validates inbound, client builds the same shape
 * before pushing to the URL. Comma-decoded `projectIds` keeps URLs human-readable
 * (`?projectIds=id1,id2`).
 */
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

export type SessionListParamsInput = z.infer<typeof sessionListParamsSchema>;
