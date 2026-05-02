/**
 * Tracked-users feature — param primitives in one place.
 *
 * @remarks
 * Grouped by concern: **poll cadences**, **activity-range bucket
 * config**, **page-distribution pagination**, **sort options**. Each
 * used to live in its own 25-70 LOC file — consolidated because every
 * consumer reaches for two or three of them together and the
 * fragmentation stopped carrying its weight. Substantive domain logic
 * (`status.ts` for bucket derivation, `resolve-display-name.ts` for
 * the trait-chain resolver) earns its own file.
 */

import { ONE_DAY_MS, ONE_HOUR_MS, ONE_MINUTE_MS, SEVEN_DAYS_MS } from "@/lib/time";


/**
 * A tracked user is considered online if their last captured event is
 * within this window. Server-side filter + client-side badge both
 * consume the same threshold so the two views can never disagree.
 */
export const ONLINE_THRESHOLD_MS = 2 * 60 * 1000;

/** Poll interval for the online-status query on the user detail page. */
export const STATUS_POLL_INTERVAL_MS = 30 * 1000;

/**
 * Poll interval for the user detail page's main data queries (activity,
 * sessions, detail). Chosen to match the smallest histogram bucket
 * (5 min) loosely — 30s feels live without burning server cycles;
 * users see new events appear in the stats and histogram within one
 * tick of ingest-flush.
 *
 * Polling runs only while the tab is focused
 * (`refetchIntervalInBackground: false`), so idle tabs don't churn
 * the API.
 */
export const USER_PAGE_POLL_INTERVAL_MS = 30 * 1000;


/**
 * Activity-range presets. Used by the activity histogram on the user
 * detail page, the sessions timeline lane chart, and the
 * `/api/tracked-users/[userId]/{activity,timeline}` routes, which
 * interpolate `pgInterval` into a `date_bin(...)` SQL call. The
 * string is safe-by-construction — a literal value from this
 * hardcoded record, not user input; `parseActivityRange` rejects
 * anything outside the union before it reaches SQL.
 */
export const ACTIVITY_RANGES = ["6h", "24h", "7d"] as const;
export type ActivityRange = (typeof ACTIVITY_RANGES)[number];

export const DEFAULT_ACTIVITY_RANGE: ActivityRange = "24h";

export type ActivityRangeConfig = {
  windowMs: number;
  bucketMs: number;
  bucketCount: number;
  pgInterval: string;
};

/**
 * Bucket configuration per range. The chart renders `bucketCount`
 * bars covering `windowMs` total; each bar aggregates events over
 * `bucketMs`.
 *
 * @remarks
 * `label` + `shortLabel` used to live here but moved to
 * `messages/<locale>/users.json::activity.<range>.{label,shortLabel}`
 * so the copy is localisable. Consumers call
 * `useTranslations("users.activity")` and read
 * `t(\`${range}.label\`)` / `.shortLabel` — keeps numeric/SQL
 * primitives ({@link pgInterval}, {@link bucketMs}) separate from
 * UI copy which has no business in a domain file.
 */
export const ACTIVITY_CONFIG: Record<ActivityRange, ActivityRangeConfig> = {
  "6h": { windowMs: 6 * ONE_HOUR_MS, bucketMs: 5 * ONE_MINUTE_MS, bucketCount: 72, pgInterval: "5 minutes" },
  "24h": { windowMs: ONE_DAY_MS, bucketMs: 15 * ONE_MINUTE_MS, bucketCount: 96, pgInterval: "15 minutes" },
  "7d": { windowMs: SEVEN_DAYS_MS, bucketMs: ONE_HOUR_MS, bucketCount: 168, pgInterval: "1 hour" },
};

/**
 * Narrow an unknown query-param value into the `ActivityRange` union.
 * Falls back to `DEFAULT_ACTIVITY_RANGE` for anything invalid — the
 * API never 400s on a bad `?range=` value, it just shows the default
 * window.
 */
export function parseActivityRange(raw: string | null | undefined): ActivityRange {
  if (raw && (ACTIVITY_RANGES as readonly string[]).includes(raw)) {
    return raw as ActivityRange;
  }
  return DEFAULT_ACTIVITY_RANGE;
}


/** Initial number of pageDistribution rows returned by the activity endpoint. */
export const PAGE_DISTRIBUTION_INITIAL = 5;

/** How many more rows each "Show more" click asks the endpoint for. */
export const PAGE_DISTRIBUTION_STEP = 10;

/**
 * Hard safety cap on the number of pageDistribution rows a single
 * request can return. Also enforced server-side on the `pageLimit`
 * query param.
 */
export const PAGE_DISTRIBUTION_MAX = 500;

/**
 * Coerce a raw `?pageLimit=N` query string into a sane integer.
 * Anything non-numeric or `<= 0` collapses back to `INITIAL`;
 * anything past `MAX` is silently clamped. The route never 400s
 * on a bad value.
 */
export function parsePageLimit(raw: string | null | undefined): number {
  const n = raw ? Number.parseInt(raw, 10) : Number.NaN;
  if (!Number.isFinite(n) || n <= 0) return PAGE_DISTRIBUTION_INITIAL;
  return Math.min(n, PAGE_DISTRIBUTION_MAX);
}


export const USER_LIST_SORT_OPTIONS = ["last-seen", "sessions", "active-time", "newest"] as const;
export type UserListSortBy = (typeof USER_LIST_SORT_OPTIONS)[number];

export const SORT_DIRECTIONS = ["desc", "asc"] as const;
export type UserListSortDir = (typeof SORT_DIRECTIONS)[number];

export const DEFAULT_USER_LIST_SORT: UserListSortBy = "last-seen";
export const DEFAULT_USER_LIST_SORT_DIR: UserListSortDir = "desc";

/**
 * Narrow an unknown query-param value into the `UserListSortBy`
 * union. Falls back to `DEFAULT_USER_LIST_SORT` for anything invalid
 * — the list page never errors on a bad `?sort=` value, it just
 * shows the default.
 */
export function parseUserListSortBy(raw: string | null | undefined): UserListSortBy {
  if (raw && (USER_LIST_SORT_OPTIONS as readonly string[]).includes(raw)) {
    return raw as UserListSortBy;
  }
  return DEFAULT_USER_LIST_SORT;
}

export function parseUserListSortDir(raw: string | null | undefined): UserListSortDir {
  if (raw === "asc") return "asc";
  return DEFAULT_USER_LIST_SORT_DIR;
}
