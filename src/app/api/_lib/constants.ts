import "server-only";

/**
 * Server-only API constants — thresholds and defaults enforced inside route handlers.
 *
 * @remarks
 * Constants that cross the server/client boundary (invite TTL, online
 * threshold, poll intervals) live in `src/api-client/**` (feature
 * `domain.ts` / `constants.ts`) or `src/lib/time.ts` so both sides
 * import from the same file. Everything here is strictly an API-side
 * concern with no client-facing counterpart.
 */

/**
 * Default page size for cursor-paginated list endpoints when `?limit=` is omitted.
 *
 * @remarks
 * The matching zod schemas ({@link sessionListParamsSchema},
 * {@link userListParamsSchema}) don't set a default themselves — they
 * leave `limit` as `number | undefined`. This constant fills that gap.
 */
export const DEFAULT_PAGE_LIMIT = 20;

/**
 * Hard ceiling on `?limit=` regardless of client request.
 *
 * @remarks
 * Mirrors the `.max(100)` constraint on `sessionListParamsSchema.limit` and
 * `userListParamsSchema.limit`. Defense-in-depth: zod validates at the
 * schema edge, `parseLimitParam` clamps as a server-side safety net.
 */
export const MAX_PAGE_LIMIT = 100;

/**
 * Per-bucket cap on distinct pathnames returned by the activity histogram.
 *
 * @remarks
 * Keeps the payload small for users who hop between dozens of pages
 * inside a single bucket — the long tail is noise the UI can't render
 * legibly anyway.
 *
 * @see {@link computeActivityHistogram}
 */
export const MAX_TOP_PAGES_PER_BUCKET = 5;
