import { z } from "zod";
import { USER_ACTIVITY_STATUSES } from "./status";
import { USER_LIST_SORT_OPTIONS, SORT_DIRECTIONS } from "./domain";

// ── List params ────────────────────────────────────────────────────────────

/**
 * Zod schema for the tracked-users list query string.
 *
 * Consumed by:
 *   - The API route handler (`GET /api/tracked-users`) to validate + narrow
 *     incoming params before hitting Prisma.
 *   - The client-side `parseUserListParams` to safely read `useSearchParams`.
 *
 * Every field is optional — omitting a field means "no filter on this axis".
 * The schema coerces comma-separated strings into arrays for `projectIds`
 * and `statuses` so the URL shape stays human-readable (`?statuses=ONLINE,ACTIVE_24H`).
 */
export const userListParamsSchema = z.object({
  search: z.string().trim().optional(),
  projectIds: z
    .string()
    .transform((s) => s.split(",").filter(Boolean))
    .pipe(z.array(z.string().min(1)))
    .optional(),
  statuses: z
    .string()
    .transform((s) => s.split(",").filter(Boolean))
    .pipe(z.array(z.enum(USER_ACTIVITY_STATUSES)))
    .optional(),
  sort: z.enum(USER_LIST_SORT_OPTIONS).optional(),
  sortDir: z.enum(SORT_DIRECTIONS).optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export type UserListParams = z.infer<typeof userListParamsSchema>;

// ── Display-name ───────────────────────────────────────────────────────────

/**
 * Schema for `PATCH /api/tracked-users/[userId]/display-name`.
 *
 * Both fields are optional and each accepts either a non-empty string (set)
 * or explicit `null` (reset to unset). A request may touch one or both
 * fields in a single call.
 *
 * `customName` — explicit override that wins over everything.
 * `traitKey` — key path into the user's traits JSON object.
 *
 * `.refine` rejects the `{}` payload (at least one field must be present)
 * to avoid accidentally successful no-op PATCHes.
 */
export const updateDisplayNameSchema = z
  .object({
    customName: z
      .union([z.string().trim().min(1, "Custom name cannot be empty").max(120, "Max 120 characters"), z.null()])
      .optional(),
    traitKey: z
      .union([z.string().trim().min(1, "Trait key cannot be empty").max(60, "Max 60 characters"), z.null()])
      .optional(),
  })
  .refine((v) => v.customName !== undefined || v.traitKey !== undefined, {
    message: "At least one of `customName` or `traitKey` must be provided",
  });

export type UpdateDisplayNameInput = z.infer<typeof updateDisplayNameSchema>;
