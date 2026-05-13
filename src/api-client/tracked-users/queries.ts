import { apiFetch } from "@/api-client/_lib/fetch";
import { pollingOptions } from "@/api-client/_lib/polling";
import { routes } from "@/api-client/_lib/routes";
import {
  queryOptions,
  useInfiniteQuery,
  useQuery,
  useSuspenseInfiniteQuery,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { cursorInfiniteQueryOptions, cursorPlaceholderData } from "@/api-client/_lib/pagination";
import { trackedUserKeys } from "./keys";
import type {
  PaginatedTrackedUsers,
  TrackedUserDetail,
  TrackedUserListItem,
  TrackedUserListParams,
  TrackedUsersSummary,
  UserActivity,
  UserStatus,
  UserTimeline,
} from "./schemas";
import type { PaginatedSessions } from "@/api-client/sessions/schemas";
import type { ActivityRange } from "@/api-client/tracked-users/domain";
import {
  STATUS_POLL_INTERVAL_MS,
  USERS_LIST_POLL_MS,
  USER_PAGE_POLL_INTERVAL_MS,
} from "@/api-client/tracked-users/constants";

function buildListQuery(params: TrackedUserListParams, cursor: string | undefined): string {
  const sp = new URLSearchParams();
  if (params.projectIds?.length) sp.set("projectIds", params.projectIds.join(","));
  if (params.statuses?.length) sp.set("statuses", params.statuses.join(","));
  if (params.sort) sp.set("sort", params.sort);
  if (params.sortDir && params.sortDir !== "desc") sp.set("sortDir", params.sortDir);
  if (params.search) sp.set("search", params.search);
  if (cursor) sp.set("cursor", cursor);
  const qs = sp.toString();
  return qs ? `?${qs}` : "";
}

export const trackedUserQueries = {
  list: (params: TrackedUserListParams = {}) =>
    cursorInfiniteQueryOptions<TrackedUserListItem>({
      queryKey: trackedUserKeys.list(params),
      fetchPage: ({ cursor, signal }) =>
        apiFetch<PaginatedTrackedUsers>(`${routes.trackedUsers.list()}${buildListQuery(params, cursor)}`, { signal }),
      ...pollingOptions(USERS_LIST_POLL_MS),
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
      // Cursor change (Load More) creates a new key — keep page 1 visible during the page-2 fetch.
      placeholderData: cursorPlaceholderData,
    }),
  timeline: (userId: string, range: ActivityRange) =>
    queryOptions({
      queryKey: trackedUserKeys.timeline(userId, range),
      queryFn: ({ signal }) =>
        apiFetch<UserTimeline>(`${routes.trackedUsers.timeline(userId)}?range=${range}`, { signal }),
      ...pollingOptions(USER_PAGE_POLL_INTERVAL_MS),
      placeholderData: cursorPlaceholderData,
    }),
  activity: (userId: string, range: ActivityRange, pageLimit: number) =>
    queryOptions({
      queryKey: trackedUserKeys.activity(userId, range, pageLimit),
      queryFn: ({ signal }) =>
        apiFetch<UserActivity>(`${routes.trackedUsers.activity(userId)}?range=${range}&pageLimit=${pageLimit}`, {
          signal,
        }),
      // One key shared by stats grid + histogram + page distribution — one refetch
      // updates all three. `pageLimit` in the key means "Show more" triggers a
      // fresh fetch that ALSO refreshes stats and histogram as a side effect.
      ...pollingOptions(USER_PAGE_POLL_INTERVAL_MS),
      placeholderData: cursorPlaceholderData,
    }),
  status: (userId: string) =>
    queryOptions({
      queryKey: trackedUserKeys.status(userId),
      queryFn: ({ signal }) => apiFetch<UserStatus>(routes.trackedUsers.status(userId), { signal }),
      ...pollingOptions(STATUS_POLL_INTERVAL_MS),
    }),
};

export function useTrackedUsersInfiniteQuery(params: TrackedUserListParams = {}) {
  return useInfiniteQuery(trackedUserQueries.list(params));
}
export function useTrackedUsersSuspenseInfiniteQuery(params: TrackedUserListParams = {}) {
  return useSuspenseInfiniteQuery(trackedUserQueries.list(params));
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
export function useUserStatusSuspenseQuery(userId: string) {
  return useSuspenseQuery(trackedUserQueries.status(userId));
}
