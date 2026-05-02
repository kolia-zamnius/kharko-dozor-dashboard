import { apiFetch } from "@/api-client/fetch";
import { pollingOptions } from "@/api-client/polling";
import { routes } from "@/api-client/routes";
import { keepPreviousData, queryOptions, useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { trackedUserKeys } from "./keys";
import type {
  PaginatedTrackedUsers,
  TrackedUserDetail,
  TrackedUserListParams,
  TrackedUsersSummary,
  UserActivity,
  UserStatus,
  UserTimeline,
} from "./types";
import type { PaginatedSessions } from "@/api-client/sessions/types";
import type { ActivityRange } from "@/api-client/tracked-users/domain";
import { STATUS_POLL_INTERVAL_MS, USER_PAGE_POLL_INTERVAL_MS } from "@/api-client/tracked-users/domain";

function buildListQuery(params: TrackedUserListParams): string {
  const sp = new URLSearchParams();
  if (params.projectIds?.length) sp.set("projectIds", params.projectIds.join(","));
  if (params.statuses?.length) sp.set("statuses", params.statuses.join(","));
  if (params.sort) sp.set("sort", params.sort);
  if (params.sortDir && params.sortDir !== "desc") sp.set("sortDir", params.sortDir);
  if (params.search) sp.set("search", params.search);
  if (params.cursor) sp.set("cursor", params.cursor);
  const qs = sp.toString();
  return qs ? `?${qs}` : "";
}


/**
 * Poll interval for the users list + summary. Reuses the same 30s cadence
 * as the user detail page so both views feel equally live.
 */
export const USERS_LIST_POLL_MS = USER_PAGE_POLL_INTERVAL_MS;


export const trackedUserQueries = {
  list: (params: TrackedUserListParams = {}) =>
    queryOptions({
      queryKey: trackedUserKeys.list(params),
      queryFn: ({ signal }) =>
        apiFetch<PaginatedTrackedUsers>(`${routes.trackedUsers.list()}${buildListQuery(params)}`, { signal }),
      ...pollingOptions(USERS_LIST_POLL_MS),
      // Filter / sort / cursor changes create new cache keys. Keep the
      // previous snapshot visible so the table never flashes empty while
      // the next page is in flight.
      placeholderData: keepPreviousData,
    }),
  summary: () =>
    queryOptions({
      queryKey: trackedUserKeys.summary(),
      queryFn: ({ signal }) => apiFetch<TrackedUsersSummary>(routes.trackedUsers.summary(), { signal }),
      ...pollingOptions(USERS_LIST_POLL_MS),
    }),
  detail: (userId: string) =>
    queryOptions({
      queryKey: trackedUserKeys.detail(userId),
      queryFn: ({ signal }) => apiFetch<TrackedUserDetail>(routes.trackedUsers.detail(userId), { signal }),
      ...pollingOptions(USER_PAGE_POLL_INTERVAL_MS),
    }),
  sessions: (userId: string, cursor?: string) =>
    queryOptions({
      queryKey: trackedUserKeys.sessions(userId, cursor),
      queryFn: ({ signal }) => {
        const qs = cursor ? `?cursor=${cursor}` : "";
        return apiFetch<PaginatedSessions>(`${routes.trackedUsers.sessions(userId)}${qs}`, { signal });
      },
      ...pollingOptions(USER_PAGE_POLL_INTERVAL_MS),
      // Cursor changes (Load More) create a new cache key. Keep the
      // previous page's data available as the placeholder so the table
      // doesn't flash empty while page 2 is in flight.
      placeholderData: keepPreviousData,
    }),
  timeline: (userId: string, range: ActivityRange) =>
    queryOptions({
      queryKey: trackedUserKeys.timeline(userId, range),
      queryFn: ({ signal }) =>
        apiFetch<UserTimeline>(`${routes.trackedUsers.timeline(userId)}?range=${range}`, { signal }),
      // Mirrors activity/sessions polling cadence so the timeline lanes
      // advance together with the histogram and stats grid.
      ...pollingOptions(USER_PAGE_POLL_INTERVAL_MS),
      // Range change → new key. Keep the previous range's lanes visible
      // during the fetch so switching range doesn't flash the page.
      placeholderData: keepPreviousData,
    }),
  activity: (userId: string, range: ActivityRange, pageLimit: number) =>
    queryOptions({
      queryKey: trackedUserKeys.activity(userId, range, pageLimit),
      queryFn: ({ signal }) =>
        apiFetch<UserActivity>(`${routes.trackedUsers.activity(userId)}?range=${range}&pageLimit=${pageLimit}`, {
          signal,
        }),
      // Auto-refresh on a cadence so the histogram, stats grid and page
      // distribution all tick forward while the user sits on the page. The
      // three components share this query key — one refetch updates all.
      // Note: `pageLimit` is part of the key, so clicking "Show more" in
      // PageDistribution triggers a fresh fetch that ALSO refreshes stats
      // and histogram as a side effect.
      ...pollingOptions(USER_PAGE_POLL_INTERVAL_MS),
      // Range / pageLimit changes create new keys. Keep the previous
      // snapshot visible across all three downstream consumers (stats,
      // histogram, page distribution) so they never flash placeholders
      // after the first successful load — the page gets one moment of
      // loading on mount, and after that data just updates in place.
      placeholderData: keepPreviousData,
    }),
  status: (userId: string) =>
    queryOptions({
      queryKey: trackedUserKeys.status(userId),
      queryFn: ({ signal }) => apiFetch<UserStatus>(routes.trackedUsers.status(userId), { signal }),
      // Short staleTime + polling so the online indicator stays lively while
      // the tab is focused, but doesn't burn cycles while it's in the background.
      ...pollingOptions(STATUS_POLL_INTERVAL_MS),
    }),
};

// Classic + Suspense pairs per query — pick based on consumer context
// (see `sessions/queries.ts` for the rationale).

export function useTrackedUsersQuery(params: TrackedUserListParams = {}) {
  return useQuery(trackedUserQueries.list(params));
}
export function useTrackedUsersSuspenseQuery(params: TrackedUserListParams = {}) {
  return useSuspenseQuery(trackedUserQueries.list(params));
}

export function useTrackedUsersSummaryQuery() {
  return useQuery(trackedUserQueries.summary());
}
export function useTrackedUsersSummarySuspenseQuery() {
  return useSuspenseQuery(trackedUserQueries.summary());
}

export function useTrackedUserQuery(userId: string) {
  return useQuery(trackedUserQueries.detail(userId));
}
export function useTrackedUserSuspenseQuery(userId: string) {
  return useSuspenseQuery(trackedUserQueries.detail(userId));
}

export function useTrackedUserSessionsQuery(userId: string, cursor?: string) {
  return useQuery(trackedUserQueries.sessions(userId, cursor));
}
export function useTrackedUserSessionsSuspenseQuery(userId: string, cursor?: string) {
  return useSuspenseQuery(trackedUserQueries.sessions(userId, cursor));
}

export function useUserTimelineQuery(userId: string, range: ActivityRange) {
  return useQuery(trackedUserQueries.timeline(userId, range));
}
export function useUserTimelineSuspenseQuery(userId: string, range: ActivityRange) {
  return useSuspenseQuery(trackedUserQueries.timeline(userId, range));
}

export function useUserActivityQuery(userId: string, range: ActivityRange, pageLimit: number) {
  return useQuery(trackedUserQueries.activity(userId, range, pageLimit));
}
export function useUserActivitySuspenseQuery(userId: string, range: ActivityRange, pageLimit: number) {
  return useSuspenseQuery(trackedUserQueries.activity(userId, range, pageLimit));
}

export function useUserStatusQuery(userId: string) {
  return useQuery(trackedUserQueries.status(userId));
}
