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
 * Composition root for the user detail page.
 *
 * @remarks
 * Suspense boundary wraps the entire content — one page-level
 * `<Spinner />` fallback. Errors bubble to
 * `/users/[userId]/error.tsx`. Global `throwOnError` in
 * `lib/query-client.ts` only throws initial-load failures, so
 * background polling flakes stay silent.
 *
 * Every data query lives in `UserDetailShellContent` (detail,
 * activity, timeline, first-page sessions). Suspense waits for all
 * four to resolve, then the full tree streams in at once. Child
 * sections are pure views that receive data as props; the range /
 * pagination state is hoisted here because the `activity` query key
 * depends on both.
 *
 * `SessionsTable` is the one exception — it still calls its own
 * `useTrackedUserSessionsSuspenseQuery` internally for page 2+
 * because it owns the cursor state for "Load more". On first render
 * the same hook returns the first page this shell already warmed,
 * so TanStack dedupes to zero extra network cost.
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

  // OWNER/ADMIN of the active org may edit `displayName` — shared hook,
  // see `useCanManageActiveOrg` for the derivation contract.
  const canManage = useCanManageActiveOrg();

  // Range is driven by URL (`?range=6h|24h|7d`) so the view is shareable.
  const searchParams = useSearchParams();
  const range = parseActivityRange(searchParams?.get("range"));

  // `pageLimit` is part of the activity query key — clicking "Show more"
  // triggers a fresh fetch that ALSO refreshes stats and chart as a side
  // effect, since all three share one query.
  const [pageLimit, setPageLimit] = useState(PAGE_DISTRIBUTION_INITIAL);

  // Reset pagination when range changes — a 7d view might have dozens of
  // unique pages while a 6h view has 3. Uses the "setState during render"
  // pattern to avoid a redundant render trip.
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

  // Hoisted queries — Suspense waits for all to resolve, after which
  // `placeholderData: keepPreviousData` on each keeps the previous
  // snapshot visible during subsequent refetches (range changes,
  // polling ticks, show-more). No loading branch here — Suspense above
  // handles the initial gate, `LastUpdated` shows the in-flight dot.
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
