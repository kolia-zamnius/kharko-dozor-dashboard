import { ONE_DAY_MS, ONE_HOUR_MS, ONE_MINUTE_MS, SEVEN_DAYS_MS } from "@/lib/time";

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
