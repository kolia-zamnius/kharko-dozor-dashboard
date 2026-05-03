import { z } from "zod";
import { USER_ACTIVITY_STATUSES } from "./status";
import { USER_LIST_SORT_OPTIONS, SORT_DIRECTIONS } from "./domain";

/**
 * Used isomorphically — server validates inbound, client builds the same shape
 * from `useSearchParams` before pushing to the URL. Comma-decoded `projectIds`
 * + `statuses` keep URLs human-readable (`?statuses=ONLINE,ACTIVE_24H`).
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

/**
 * Both fields three-state: omit = leave alone, non-empty string = set, `null` =
 * reset. `.refine` rejects the empty body so a no-op PATCH can't pass silently.
 * `customName` wins over everything; `traitKey` is a key path into the user's
 * traits JSON.
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
