import "server-only";

import type { UserActivityStatus } from "@/api-client/tracked-users/domain";
import type { EnrichedTrackedUser } from "./enrich";

type FilterParams = {
  readonly search?: string;
  readonly statuses?: readonly UserActivityStatus[];
};

/**
 * Display-name search lives here because the resolved name often comes from a
 * per-project trait key — Prisma can only narrow on stored columns. Once
 * we're in JS the (also-derived) status filter tags along. AND-combined.
 */
export function filterEnrichedTrackedUsers(
  rows: readonly EnrichedTrackedUser[],
  params: FilterParams,
): EnrichedTrackedUser[] {
  const { search, statuses } = params;
  const needle = search ? search.toLowerCase() : null;
  const statusSet = statuses && statuses.length > 0 ? new Set(statuses) : null;

  if (!needle && !statusSet) {
    return [...rows];
  }

  return rows.filter((row) => {
    if (statusSet && !statusSet.has(row.status)) return false;
    if (needle) {
      const matchesExternalId = row.externalId.toLowerCase().includes(needle);
      const matchesDisplayName = row.displayName.toLowerCase().includes(needle);
      if (!matchesExternalId && !matchesDisplayName) return false;
    }
    return true;
  });
}
