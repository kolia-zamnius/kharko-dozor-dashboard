import "server-only";

import type { EnrichedTrackedUser } from "./enrich";

export type TrackedUsersSortKey = "last-seen" | "sessions" | "active-time" | "newest";
export type SortDirection = "asc" | "desc";

/** Only desc is defined; asc flips sign via multiplier — adding a key is a single-line edit. */
const DESC_COMPARATORS: Record<TrackedUsersSortKey, (a: EnrichedTrackedUser, b: EnrichedTrackedUser) => number> = {
  "last-seen": (a, b) => timestampOrZero(b.lastEventAt) - timestampOrZero(a.lastEventAt),
  sessions: (a, b) => b.sessionCount - a.sessionCount,
  "active-time": (a, b) => b.activeTime7d - a.activeTime7d,
  newest: (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
};

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
