import "server-only";

import type { EnrichedTrackedUser } from "./enrich";

export type TrackedUsersSortKey = "last-seen" | "sessions" | "active-time" | "newest";
export type SortDirection = "asc" | "desc";

/**
 * Descending comparators keyed by sort key.
 *
 * @remarks
 * Only desc is defined; asc flips sign via multiplier. Adding a new
 * sort key is a single-file change.
 */
const DESC_COMPARATORS: Record<TrackedUsersSortKey, (a: EnrichedTrackedUser, b: EnrichedTrackedUser) => number> = {
  "last-seen": (a, b) => timestampOrZero(b.lastEventAt) - timestampOrZero(a.lastEventAt),
  sessions: (a, b) => b.sessionCount - a.sessionCount,
  "active-time": (a, b) => b.activeTime7d - a.activeTime7d,
  newest: (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
};

/**
 * Sort enriched rows by key + direction.
 *
 * @remarks
 * Returns a new array; does not mutate.
 *
 * @param rows - Enriched rows (already filtered).
 * @param key - Sort field from the client's `sort` param.
 * @param direction - `"asc"` or `"desc"` from the client's `sortDir` param.
 */
export function sortEnrichedTrackedUsers(
  rows: readonly EnrichedTrackedUser[],
  key: TrackedUsersSortKey,
  direction: SortDirection,
): EnrichedTrackedUser[] {
  const descending = DESC_COMPARATORS[key];
  const multiplier = direction === "asc" ? -1 : 1;
  return [...rows].sort((a, b) => descending(a, b) * multiplier);
}

function timestampOrZero(iso: string | null): number {
  return iso ? new Date(iso).getTime() : 0;
}
