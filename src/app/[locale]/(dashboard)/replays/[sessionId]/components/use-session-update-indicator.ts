import { useQueryClient } from "@tanstack/react-query";
import { useState, useTransition } from "react";

import { sessionKeys } from "@/api-client/sessions/keys";
import { useSessionQuery } from "@/api-client/sessions/queries";
import type { SessionDetail } from "@/api-client/sessions/types";
import { detectSessionUpdates, type SessionUpdate } from "@/api-client/sessions/updates";

export type SessionUpdateIndicator =
  | { status: "loading" }
  | { status: "missing" }
  | {
      status: "ready";
      /**
       * The snapshot currently driving the player. Frozen at the
       * moment the admin either landed on the page or clicked the
       * refresh button — NOT the rolling `latest` value from polling.
       */
      snapshot: SessionDetail;
      /** Diff between `snapshot` and the freshest poll result. */
      updates: SessionUpdate[];
      /** Incremented every `apply()` so callers can re-key the player. */
      refreshTick: number;
      /** True while a transition triggered by `apply()` is in flight. */
      isApplying: boolean;
      /**
       * Promote the latest polled data into the player snapshot,
       * invalidate cached slice events (so the new snapshot picks up
       * fresh rrweb events per slice), and bump `refreshTick` so the
       * player remounts on the new key.
       */
      apply: () => void;
    };

/**
 * GitHub-style "updates available" indicator for the replay page.
 *
 * Keeps two layers of state separated:
 *
 *   1. A **snapshot** captured on first load and held in local state.
 *      This is what the player actually renders. rrweb Replayer needs
 *      a stable event stream, so we never feed it the rolling query
 *      cache.
 *   2. The **latest** query cache — polled in the background per
 *      `sessionQueries.detail`. When it diverges from the snapshot,
 *      we surface the diff via `updates` so the header can light up
 *      the refresh button.
 *
 * `apply()` bridges the two: bumps the snapshot to latest, invalidates
 * slice events so the fresh rrweb stream loads, and increments
 * `refreshTick` so the player remounts. Wrapped in `startTransition`
 * because rrweb Replayer teardown + re-init is heavy (~100-300ms on
 * big sessions) and we want the refresh button's spinner to appear
 * before the main thread stalls.
 *
 * Snapshot-in-local-state is a legit React pattern for "frozen state
 * after mount" — we aren't mirroring server state, we're capturing a
 * point in time. TanStack cache is still the single source for the
 * polled value; we just decouple "what's on screen" from "what's
 * freshest on the server".
 */
export function useSessionUpdateIndicator(sessionId: string): SessionUpdateIndicator {
  // Straight factory call — `sessionQueries.detail` already carries the
  // polling config (`refetchInterval`, `refetchIntervalInBackground`).
  // End-of-session cancellation is skipped for now: once `endedAt`
  // lands, subsequent polls return identical data and produce no
  // updates, so the indicator stays dormant. Cheap enough at 10s
  // cadence to not warrant a separate dynamic-interval override.
  const query = useSessionQuery(sessionId);
  const queryClient = useQueryClient();

  const [snapshot, setSnapshot] = useState<SessionDetail | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);
  const [isApplying, startTransition] = useTransition();

  // Capture the first data arrival as the snapshot. Uses the React
  // "storing info from previous renders" pattern (setState during
  // render with a sentinel) rather than `useEffect`, which would need
  // an extra render trip and flag the new `react-hooks/set-state-in-
  // effect` lint rule.
  if (snapshot === null && query.data) {
    setSnapshot(query.data);
  }

  if (query.isLoading && !snapshot) {
    return { status: "loading" };
  }

  if (!snapshot) {
    return { status: "missing" };
  }

  const latest = query.data ?? snapshot;
  const updates = latest === snapshot ? [] : detectSessionUpdates(snapshot, latest);

  function apply() {
    if (!query.data) return;
    const nextSnapshot = query.data;
    startTransition(() => {
      setSnapshot(nextSnapshot);
      setRefreshTick((tick) => tick + 1);
      // Slice events are `staleTime: Infinity` snapshots keyed on
      // `(sessionId, sliceIndex)`. After we bump the session snapshot
      // we want the player to refetch events for whichever slice it
      // lands on, so we invalidate every slice-events query under this
      // session at once — cheap relative to the rrweb remount itself.
      void queryClient.invalidateQueries({ queryKey: sessionKeys.sliceEventsBySession(sessionId) });
    });
  }

  return { status: "ready", snapshot, updates, refreshTick, isApplying, apply };
}
