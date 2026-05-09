import { apiFetch } from "@/api-client/_lib/fetch";
import { pollingOptions } from "@/api-client/_lib/polling";
import { routes } from "@/api-client/_lib/routes";
import { queryOptions, useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { cursorPlaceholderData } from "@/api-client/_lib/pagination";
import { sessionKeys } from "./keys";
import type {
  PaginatedSessions,
  SessionDetail,
  SessionEventsResponse,
  SessionListParams,
  SessionMarkersResponse,
  SessionsSummary,
} from "./schemas";
import { DEFAULT_SESSION_DATE_RANGE } from "./domain";
import { SESSION_DETAIL_POLL_MS, SESSIONS_LIST_POLL_MS } from "./constants";

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
      placeholderData: cursorPlaceholderData,
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
      // `staleTime: 0` lets the interval tick reach the server — the player freezes
      // on its own snapshot, the poll only refreshes the "latest" reference for the
      // refresh-button diff. `background: true` so DevTools-in-side-window admins
      // still see the orange dot light up.
      ...pollingOptions(SESSION_DETAIL_POLL_MS, { staleTime: 0, background: true }),
    }),
  events: (sessionId: string) =>
    queryOptions({
      queryKey: sessionKeys.events(sessionId),
      queryFn: ({ signal }) => apiFetch<SessionEventsResponse>(routes.sessions.events(sessionId), { signal }),
      // Events are immutable once captured.
      staleTime: Infinity,
    }),
  markers: (sessionId: string) =>
    queryOptions({
      queryKey: sessionKeys.markers(sessionId),
      queryFn: ({ signal }) => apiFetch<SessionMarkersResponse>(routes.sessions.markers(sessionId), { signal }),
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
export function useSessionSuspenseQuery(sessionId: string) {
  return useSuspenseQuery(sessionQueries.detail(sessionId));
}

export function useSessionEventsQuery(sessionId: string) {
  return useQuery(sessionQueries.events(sessionId));
}
export function useSessionEventsSuspenseQuery(sessionId: string) {
  return useSuspenseQuery(sessionQueries.events(sessionId));
}

export function useSessionMarkersQuery(sessionId: string) {
  return useQuery(sessionQueries.markers(sessionId));
}
export function useSessionMarkersSuspenseQuery(sessionId: string) {
  return useSuspenseQuery(sessionQueries.markers(sessionId));
}
