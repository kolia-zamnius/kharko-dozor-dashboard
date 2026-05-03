import "server-only";

// API-side only — constants that cross to the client live in `api-client/**` or `lib/time.ts`.

/** Fills the gap left by the list schemas leaving `limit` as `number | undefined`. */
export const DEFAULT_PAGE_LIMIT = 20;

/** Defence-in-depth — mirrors the `.max(100)` on the list schemas; `parseLimitParam` clamps as a server-side safety net. */
export const MAX_PAGE_LIMIT = 100;

/** Activity histogram cap — long tail of distinct pathnames is noise the UI can't render legibly. */
export const MAX_TOP_PAGES_PER_BUCKET = 5;
