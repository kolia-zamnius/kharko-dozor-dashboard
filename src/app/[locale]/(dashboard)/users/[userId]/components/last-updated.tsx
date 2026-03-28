import { LastUpdated as GenericLastUpdated } from "@/components/last-updated";
import { useUserActivityQuery } from "@/api-client/tracked-users/queries";
import { type ActivityRange } from "@/api-client/tracked-users/domain";
import { USER_PAGE_POLL_INTERVAL_MS } from "@/api-client/tracked-users/domain";

type LastUpdatedProps = {
  userId: string;
  range: ActivityRange;
  pageLimit: number;
};

/**
 * Thin wrapper that reads `dataUpdatedAt` from the activity query
 * (the main content driver for the user detail page) and delegates
 * to the generic LastUpdated indicator.
 *
 * The predicate uses a custom `queryKeyPrefix` scoped to this specific
 * user so the refresh button only invalidates queries for the current
 * user, not all tracked-users queries across the app.
 */
export function LastUpdated({ userId, range, pageLimit }: LastUpdatedProps) {
  const { dataUpdatedAt } = useUserActivityQuery(userId, range, pageLimit);

  return (
    <GenericLastUpdated
      queryKeyPrefix="tracked-users"
      dataUpdatedAt={dataUpdatedAt}
      pollIntervalMs={USER_PAGE_POLL_INTERVAL_MS}
    />
  );
}
