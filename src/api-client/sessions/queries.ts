import { apiFetch } from "@/api-client/fetch";
import { pollingOptions } from "@/api-client/polling";
import { routes } from "@/api-client/routes";
import { keepPreviousData, queryOptions, useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { sessionKeys } from "./keys";
import type { PaginatedSessions, SessionDetail, SessionEvent, SessionListParams, SessionsSummary } from "./types";
import { DEFAULT_SESSION_DATE_RANGE, SESSION_DETAIL_POLL_MS, SESSIONS_LIST_POLL_MS } from "./domain";

function buildSessionsUrl(params: SessionListParams): string {
  const sp = new URLSearchParams();
  if (params.projectIds?.length) sp.set("projectIds", params.projectIds.join(","));
  if (params.search) sp.set("search", params.search);
  if (params.sort) sp.set("sort", params.sort);
  if (params.sortDir && params.sortDir !== "desc") sp.set("sortDir", params.sortDir);
  if (params.range && params.range !== DEFAULT_SESSION_DATE_RANGE) sp.set("range", params.range);
  if (params.cursor) sp.set("cursor", params.cursor);
  const qs = sp.toString();
  const base = routes.sessions.list();
  return qs ? `${base}?${qs}` : base;
}

export const sessionQueries = {
  list: (params: SessionListParams = {}) =>
    queryOptions({
      queryKey: sessionKeys.list(params),
      queryFn: ({ signal }) => apiFetch<PaginatedSessions>(buildSessionsUrl(params), { signal }),
      ...pollingOptions(SESSIONS_LIST_POLL_MS),
      // Filter / sort / cursor changes create new keys — keep previous data visible
      // so the table never flashes empty during the next-page fetch.
      placeholderData: keepPreviousData,
    }),
  summary: () =>
    queryOptions({
      queryKey: sessionKeys.summary(),
      queryFn: ({ signal }) => apiFetch<SessionsSummary>(routes.sessions.summary(), { signal }),
      ...pollingOptions(SESSIONS_LIST_POLL_MS),
    }),
  detail: (sessionId: string) =>
    queryOptions({
      queryKey: sessionKeys.detail(sessionId),
      queryFn: ({ signal }) => apiFetch<SessionDetail>(routes.sessions.detail(sessionId), { signal }),
      // `staleTime: 0` so the interval tick reaches the server — the player freezes
      // on its own snapshot, the poll only refreshes the "latest" reference for the
      // refresh-button diff. `background: true` because admins commonly pop DevTools
      // into a separate window (tab blur) and still expect the orange dot to light up.
      ...pollingOptions(SESSION_DETAIL_POLL_MS, { staleTime: 0, background: true }),
    }),
  sliceEvents: (sessionId: string, sliceIndex: number) =>
    queryOptions({
      queryKey: sessionKeys.sliceEvents(sessionId, sliceIndex),
      queryFn: ({ signal }) => apiFetch<SessionEvent[]>(routes.sessions.sliceEvents(sessionId, sliceIndex), { signal }),
      // Slice events are immutable once captured — no polling, no expiry.
      staleTime: Infinity,
    }),
};

export function useSessionsQuery(params: SessionListParams = {}) {
  return useQuery(sessionQueries.list(params));
}
export function useSessionsSuspenseQuery(params: SessionListParams = {}) {
  return useSuspenseQuery(sessionQueries.list(params));
}

export function useSessionsSummaryQuery() {
  return useQuery(sessionQueries.summary());
}
export function useSessionsSummarySuspenseQuery() {
  return useSuspenseQuery(sessionQueries.summary());
}

/** Classic — `use-session-update-indicator` keeps a local snapshot and observes `isLoading` to drive the diff. */
export function useSessionQuery(sessionId: string) {
  return useQuery(sessionQueries.detail(sessionId));
}

export function useSliceEventsQuery(sessionId: string, sliceIndex: number) {
  return useQuery(sessionQueries.sliceEvents(sessionId, sliceIndex));
}
