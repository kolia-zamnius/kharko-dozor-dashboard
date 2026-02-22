/**
 * Shared polling options for `queryOptions({ ... })`.
 *
 * @remarks
 * Ten sites across the codebase were spelling out the same three lines:
 *
 * ```ts
 * staleTime: POLL_MS / 2,
 * refetchInterval: POLL_MS,
 * refetchIntervalInBackground: false,
 * ```
 *
 * The `/2` relationship is deliberate — stale time is half the poll
 * window, so `useQuery` never short-circuits against fresh cache on the
 * interval tick. Centralizing it here means the math can never drift
 * (e.g. someone setting `staleTime: 30_000` + `interval: 10_000` by
 * mistake and silently breaking polling).
 *
 * `background` defaults to `false` because tab-blurred polling is
 * usually waste; the replay page's `sessions.detail` query opts in
 * because admins leave it open in a separate window and expect the
 * orange "updates available" indicator to light up regardless.
 *
 * `staleTime` can be overridden for the rare case where the interval
 * tick should ALWAYS reach the network (not just when cached data is
 * stale) — e.g. `sessions.detail` passes `staleTime: 0` because the
 * replay page keeps its own local snapshot and polls purely to drive
 * the refresh-button diff; short-circuiting against the cache would
 * silently skip polls once data landed.
 *
 * @example
 * ```ts
 * // List polling — the default /2 cadence math
 * queryOptions({
 *   queryKey: sessionKeys.list(params),
 *   queryFn: () => apiFetch(...),
 *   ...pollingOptions(SESSIONS_LIST_POLL_MS),
 *   placeholderData: keepPreviousData,
 * })
 *
 * // Replay page — always refetch on tick, run in background tabs
 * queryOptions({
 *   queryKey: sessionKeys.detail(id),
 *   queryFn: () => apiFetch(...),
 *   ...pollingOptions(SESSION_DETAIL_POLL_MS, { staleTime: 0, background: true }),
 * })
 * ```
 */
export function pollingOptions(
  pollMs: number,
  opts?: { background?: boolean; staleTime?: number },
): { staleTime: number; refetchInterval: number; refetchIntervalInBackground: boolean } {
  return {
    staleTime: opts?.staleTime ?? pollMs / 2,
    refetchInterval: pollMs,
    refetchIntervalInBackground: opts?.background ?? false,
  };
}
