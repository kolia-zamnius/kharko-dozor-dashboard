"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useState } from "react";

import { Spinner } from "@/components/ui/feedback/spinner";
import {
  PAGE_DISTRIBUTION_INITIAL,
  PAGE_DISTRIBUTION_MAX,
  PAGE_DISTRIBUTION_STEP,
  parseActivityRange,
} from "@/api-client/tracked-users/domain";
import {
  useTrackedUserSessionsSuspenseQuery,
  useTrackedUserSuspenseQuery,
  useUserActivitySuspenseQuery,
  useUserTimelineSuspenseQuery,
} from "@/api-client/tracked-users/queries";
import { useCanManageActiveOrg } from "@/lib/hooks/use-can-manage-active-org";
import { ActivityChart } from "./activity";
import { LastUpdated } from "./last-updated";
import { PageDistribution } from "./page-distribution";
import { RangeSelector } from "./range-selector";
import { SessionsTable } from "./sessions-table";
import { SessionsTimeline } from "./sessions-timeline";
import { UserHeader } from "./header";
import { UserStats } from "./stats";
import { UserTraits } from "./user-traits";

type UserDetailShellProps = {
  userId: string;
};

/**
 * One Suspense for the whole tree — four queries (detail/activity/timeline/
 * first-page-sessions) resolve together so the page streams in once. Range +
 * pageLimit are hoisted because the activity query key depends on both.
 *
 * `SessionsTable` re-calls the same query for page 2+ — TanStack dedupes the
 * first page to zero network cost.
 */
export function UserDetailShell({ userId }: UserDetailShellProps) {
  return (
    <Suspense
      fallback={
        <div className="mx-auto flex max-w-5xl justify-center py-24">
          <Spinner />
        </div>
      }
    >
      <UserDetailShellContent userId={userId} />
    </Suspense>
  );
}

function UserDetailShellContent({ userId }: UserDetailShellProps) {
  const { data: user } = useTrackedUserSuspenseQuery(userId);

  const canManage = useCanManageActiveOrg();

  // URL-driven so the view is shareable.
  const searchParams = useSearchParams();
  const range = parseActivityRange(searchParams?.get("range"));

  // `pageLimit` is part of the activity query key — Show More refreshes stats + chart as a side effect.
  const [pageLimit, setPageLimit] = useState(PAGE_DISTRIBUTION_INITIAL);

  // setState-during-render — `useEffect` would need an extra render trip.
  const [prevRange, setPrevRange] = useState(range);
  if (prevRange !== range) {
    setPrevRange(range);
    setPageLimit(PAGE_DISTRIBUTION_INITIAL);
  }

  const handleShowMore = useCallback(() => {
    setPageLimit((n) => Math.min(n + PAGE_DISTRIBUTION_STEP, PAGE_DISTRIBUTION_MAX));
  }, []);

  const handleShowLess = useCallback(() => {
    setPageLimit((n) => Math.max(n - PAGE_DISTRIBUTION_STEP, PAGE_DISTRIBUTION_INITIAL));
  }, []);

  // `keepPreviousData` on each keeps the previous snapshot visible during
  // subsequent refetches (range, polling, show-more). `LastUpdated` shows the in-flight dot.
  const activity = useUserActivitySuspenseQuery(userId, range, pageLimit);
  const timeline = useUserTimelineSuspenseQuery(userId, range);
  const initialSessions = useTrackedUserSessionsSuspenseQuery(userId, undefined);

  return (
    <div className="mx-auto max-w-5xl space-y-6 py-6">
      <div className="flex items-center justify-between gap-3">
        <RangeSelector />
        <LastUpdated userId={userId} range={range} pageLimit={pageLimit} />
      </div>
      <UserHeader user={user} canManage={canManage} />
      <UserTraits traits={user.traits} />
      <UserStats data={activity.data} range={range} />
      <ActivityChart data={activity.data} range={range} />
      <PageDistribution
        data={activity.data}
        pageLimit={pageLimit}
        onShowMore={handleShowMore}
        onShowLess={handleShowLess}
      />
      <SessionsTimeline data={timeline.data} range={range} />
      <SessionsTable userId={userId} initialPage={initialSessions.data} />
    </div>
  );
}
