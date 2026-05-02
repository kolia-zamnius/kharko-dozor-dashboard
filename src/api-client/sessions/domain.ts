/**
 * Sessions feature — param primitives in one place.
 *
 * @remarks
 * Three concerns the sessions list shares with itself, the detail page,
 * and the cache key factory: **poll cadences**, **date-range presets**,
 * and **sort options**. Each used to live in its own 20-50 LOC file
 * (`poll-intervals.ts`, `date-range.ts`, `sort-options.ts`) — the split
 * was motivated by "one concept per file" but in practice every consumer
 * reaches for two of the three at once, so the fragmentation just made
 * the folder noisy. Consolidated here with clear section headers; the
 * sibling `types.ts` holds response DTOs + request-param shapes.
 *
 * The parallel file `tracked-users/domain.ts` follows the same template
 * for the same reasons — one concept = one section, one feature = one
 * domain file.
 */

import { SESSION_RETENTION_MS, SEVEN_DAYS_MS, THIRTY_DAYS_MS } from "@/lib/time";


/**
 * Poll cadence for the sessions list + summary. 30s is a dashboard-
 * appropriate "glance" interval — too fast burns bandwidth on idle
 * tabs, too slow makes the stats strip feel stale when the admin is
 * waiting for a new session to appear.
 */
export const SESSIONS_LIST_POLL_MS = 30_000;

/**
 * How often the replay page re-fetches `GET /api/sessions/:id` while a
 * session is still open (i.e. `endedAt === null`). 10s is tight on
 * purpose — the replay page is an "active watching" surface (admin is
 * staring at the player, not scanning a list), so the orange refresh
 * button needs to surface new slices / events quickly enough that
 * it's useful for live debugging. Tab-blurred windows skip polls
 * entirely via `refetchIntervalInBackground: false` on the query
 * factory, so the cost stops when the admin switches away.
 *
 * Ended sessions are frozen snapshots — their query factory turns the
 * interval off dynamically (`refetchInterval` as a function returning
 * `false` when `endedAt` is set).
 */
export const SESSION_DETAIL_POLL_MS = 10_000;


/**
 * Date-range presets for the sessions list filter.
 *
 * @remarks
 * Literal union, config map, narrowing parser. The server computes exact
 * UTC boundaries from the preset name — the client never sends raw
 * from/to timestamps.
 *
 * `"90d"` is the widest preset (not `"all"`) because sessions older than
 * `SESSION_RETENTION_DAYS` are hard-deleted by the nightly cron anyway.
 * Advertising "All time" when the DB physically can't hold anything
 * older than 90 days was a UX lie — the preset is now honest about the
 * window. Adjusting retention in `src/lib/time.ts` flips the widest
 * preset's lower bound automatically.
 */
export const SESSION_DATE_RANGES = ["today", "7d", "30d", "90d"] as const;
export type SessionDateRange = (typeof SESSION_DATE_RANGES)[number];

export const DEFAULT_SESSION_DATE_RANGE: SessionDateRange = "90d";

/**
 * Compute the UTC `from` timestamp for a given preset.
 *
 * @remarks
 * `"90d"` is anchored to `SESSION_RETENTION_MS` rather than a hardcoded
 * `90 * ONE_DAY_MS`, so the client filter and the cron cutoff in
 * `GET /api/cron/daily-cleanup` stay in lockstep via a single constant.
 */
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

/**
 * Narrow an unknown query-param value into the `SessionListSortBy`
 * union. Falls back to default for anything invalid — the page never
 * errors on a bad `?sort=` value, it just shows the default.
 */
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
