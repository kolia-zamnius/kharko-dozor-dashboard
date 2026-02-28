import { z } from "zod";
import { SESSION_LIST_SORT_OPTIONS, SORT_DIRECTIONS } from "./domain";
import { SESSION_DATE_RANGES } from "./domain";

/**
 * Zod schema for the sessions list query string.
 *
 * Consumed by:
 *   - The API route handler (`GET /api/sessions`) to validate + narrow
 *     incoming params before hitting Prisma.
 *   - The client-side `buildSessionsUrl` to safely build query strings.
 *
 * Every field is optional — omitting a field means "no filter on this axis".
 * The schema coerces comma-separated strings into arrays for `projectIds`
 * so the URL shape stays human-readable (`?projects=id1,id2`).
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
