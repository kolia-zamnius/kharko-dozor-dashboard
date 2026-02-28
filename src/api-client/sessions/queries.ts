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

// ── Query factories ────────────────────────────────────────────────────────

export const sessionQueries = {
  list: (params: SessionListParams = {}) =>
    queryOptions({
      queryKey: sessionKeys.list(params),
      queryFn: ({ signal }) => apiFetch<PaginatedSessions>(buildSessionsUrl(params), { signal }),
      ...pollingOptions(SESSIONS_LIST_POLL_MS),
      // Filter / sort / cursor changes create new cache keys. Keep the
      // previous snapshot visible so the table never flashes empty while
      // the next page is in flight.
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
      // `staleTime: 0` so the interval tick actually reaches the server
      // instead of short-circuiting against the cache — the player
      // freezes on its own local snapshot (see
      // `useSessionUpdateIndicator`), so the poll's only job is to keep
      // the "latest" reference fresh for the refresh-button diff.
      //
      // `background: true` because admins frequently pop DevTools into
      // a separate window (tab blur) and still expect the orange
      // "updates available" dot to light up when new data lands.
      ...pollingOptions(SESSION_DETAIL_POLL_MS, { staleTime: 0, background: true }),
    }),
  sliceEvents: (sessionId: string, sliceIndex: number) =>
    queryOptions({
      queryKey: sessionKeys.sliceEvents(sessionId, sliceIndex),
      queryFn: ({ signal }) => apiFetch<SessionEvent[]>(routes.sessions.sliceEvents(sessionId, sliceIndex), { signal }),
      staleTime: Infinity,
    }),
};

// ── Hooks ─────────────────────────────────────────────────────────────────
// Two flavours per query — classic (`useQuery`) for components that tolerate
// `data: undefined` (widgets, polling indicators, the replay `use-session-
// update-indicator` snapshot pattern); Suspense for page shells that prefer
// one page-level `<Suspense>` fallback over per-hook loading branches.

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

/**
 * Classic — `use-session-update-indicator` keeps its own local snapshot
 * and polls this query to diff against. The snapshot pattern depends on
 * observing `isLoading`, so this hook stays non-Suspense.
 */
export function useSessionQuery(sessionId: string) {
  return useQuery(sessionQueries.detail(sessionId));
}

export function useSliceEventsQuery(sessionId: string, sliceIndex: number) {
  return useQuery(sessionQueries.sliceEvents(sessionId, sliceIndex));
}
