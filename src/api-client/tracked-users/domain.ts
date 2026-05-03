/**
 * Tracked-users feature primitives — poll cadences, activity-range bucket config,
 * page-distribution pagination, sort options. Substantive domain logic
 * (`status.ts` for bucket derivation, `resolve-display-name.ts` for the
 * trait-chain resolver) earns its own file.
 */

import { ONE_DAY_MS, ONE_HOUR_MS, ONE_MINUTE_MS, SEVEN_DAYS_MS } from "@/lib/time";

/**
 * Online if last event lands within this window. Server-side filter + client-side
 * badge consume the same threshold so the two views can never disagree.
 */
export const ONLINE_THRESHOLD_MS = 2 * 60 * 1000;

export const STATUS_POLL_INTERVAL_MS = 30 * 1000;

/**
 * User detail page (activity, sessions, detail). Tab-blurred skips polls via
 * `refetchIntervalInBackground: false` on the query factory.
 */
export const USER_PAGE_POLL_INTERVAL_MS = 30 * 1000;

/**
 * Activity-range presets. Server interpolates `pgInterval` into a `date_bin(...)`
 * SQL call — safe because the value is a literal from this hardcoded record,
 * not user input (`parseActivityRange` rejects anything outside the union).
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
 * Bucket config per range. Labels live in `messages/<locale>/users.json::activity.<range>.{label,shortLabel}`
 * — UI copy stays out of this file so route handlers never accidentally pull
 * Tailwind / display strings into the SQL path.
 */
export const ACTIVITY_CONFIG: Record<ActivityRange, ActivityRangeConfig> = {
  "6h": { windowMs: 6 * ONE_HOUR_MS, bucketMs: 5 * ONE_MINUTE_MS, bucketCount: 72, pgInterval: "5 minutes" },
  "24h": { windowMs: ONE_DAY_MS, bucketMs: 15 * ONE_MINUTE_MS, bucketCount: 96, pgInterval: "15 minutes" },
  "7d": { windowMs: SEVEN_DAYS_MS, bucketMs: ONE_HOUR_MS, bucketCount: 168, pgInterval: "1 hour" },
};

export function parseActivityRange(raw: string | null | undefined): ActivityRange {
  if (raw && (ACTIVITY_RANGES as readonly string[]).includes(raw)) {
    return raw as ActivityRange;
  }
  return DEFAULT_ACTIVITY_RANGE;
}

export const PAGE_DISTRIBUTION_INITIAL = 5;
export const PAGE_DISTRIBUTION_STEP = 10;
/** Hard cap also enforced server-side on the `pageLimit` query param. */
export const PAGE_DISTRIBUTION_MAX = 500;

/** Coerce `?pageLimit=N`. Non-numeric or `<= 0` collapses to `INITIAL`; over `MAX` clamps silently — the route never 400s. */
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
