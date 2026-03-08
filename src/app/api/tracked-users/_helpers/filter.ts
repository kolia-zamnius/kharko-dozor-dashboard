import "server-only";

import type { UserActivityStatus } from "@/api-client/tracked-users/status";
import type { EnrichedTrackedUser } from "./enrich";

type FilterParams = {
  readonly search?: string;
  readonly statuses?: readonly UserActivityStatus[];
};

/**
 * Apply in-JS search + status filters to an enriched row set.
 *
 * @remarks
 * Prisma can only narrow by stored columns (`externalId`, `customName`).
 * The resolved display name often comes from a per-project trait key,
 * so display-name search has to happen post-enrich — and once we're in
 * JS, the status filter (also derived) tags along.
 *
 * Both filters are AND-combined. Returns a new array — does not mutate.
 *
 * @param rows - Enriched rows from {@link enrichTrackedUser}.
 * @param params - Parsed `userListParamsSchema` subset.
 * @returns Filtered rows (new array).
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
