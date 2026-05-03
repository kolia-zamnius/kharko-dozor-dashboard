/**
 * Sessions feature primitives — poll cadences, date-range presets, sort options.
 * Sibling `tracked-users/domain.ts` follows the same template.
 */

import { SESSION_RETENTION_MS, SEVEN_DAYS_MS, THIRTY_DAYS_MS } from "@/lib/time";

/** Glance cadence for the sessions list + summary. */
export const SESSIONS_LIST_POLL_MS = 30_000;

/**
 * Replay page (active-watching surface). Tab-blurred skips polls via
 * `refetchIntervalInBackground: false`. Ended sessions are frozen — the query
 * factory turns the interval off dynamically when `endedAt !== null`.
 */
export const SESSION_DETAIL_POLL_MS = 10_000;

/**
 * `90d` is the widest preset (not "All time") because sessions older than
 * `SESSION_RETENTION_DAYS` are hard-deleted by the nightly cron — advertising
 * "All time" while the DB physically can't hold older data was a UX lie.
 * Adjusting retention in `lib/time.ts` flips the lower bound automatically via
 * `dateRangeToFrom`'s anchor on `SESSION_RETENTION_MS`.
 */
export const SESSION_DATE_RANGES = ["today", "7d", "30d", "90d"] as const;
export type SessionDateRange = (typeof SESSION_DATE_RANGES)[number];

export const DEFAULT_SESSION_DATE_RANGE: SessionDateRange = "90d";

export function dateRangeToFrom(range: SessionDateRange, now = new Date()): Date {
  switch (range) {
    case "today": {
      const d = new Date(now);
      d.setUTCHours(0, 0, 0, 0);
      return d;
    }
    case "7d":
      return new Date(now.getTime() - SEVEN_DAYS_MS);
    case "30d":
      return new Date(now.getTime() - THIRTY_DAYS_MS);
    case "90d":
      return new Date(now.getTime() - SESSION_RETENTION_MS);
  }
}

export function parseSessionDateRange(raw: string | null | undefined): SessionDateRange {
  if (raw && (SESSION_DATE_RANGES as readonly string[]).includes(raw)) {
    return raw as SessionDateRange;
  }
  return DEFAULT_SESSION_DATE_RANGE;
}

export const SESSION_LIST_SORT_OPTIONS = ["date", "duration"] as const;
export type SessionListSortBy = (typeof SESSION_LIST_SORT_OPTIONS)[number];

export const SORT_DIRECTIONS = ["desc", "asc"] as const;
export type SessionListSortDir = (typeof SORT_DIRECTIONS)[number];

export const DEFAULT_SESSION_LIST_SORT: SessionListSortBy = "date";
export const DEFAULT_SESSION_LIST_SORT_DIR: SessionListSortDir = "desc";

/** Falls back to default for invalid input — page never errors on a bad `?sort=`. */
export function parseSessionListSortBy(raw: string | null | undefined): SessionListSortBy {
  if (raw && (SESSION_LIST_SORT_OPTIONS as readonly string[]).includes(raw)) {
    return raw as SessionListSortBy;
  }
  return DEFAULT_SESSION_LIST_SORT;
}

export function parseSessionListSortDir(raw: string | null | undefined): SessionListSortDir {
  if (raw === "asc") return "asc";
  return DEFAULT_SESSION_LIST_SORT_DIR;
}
