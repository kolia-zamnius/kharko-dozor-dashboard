import { useQueryClient } from "@tanstack/react-query";
import { useState, useTransition } from "react";

import { sessionKeys } from "@/api-client/sessions/keys";
import { useSessionQuery } from "@/api-client/sessions/queries";
import type { SessionDetail } from "@/api-client/sessions/schemas";
import { detectSessionUpdates, type SessionUpdate } from "@/api-client/sessions/domain";

export type SessionUpdateIndicator =
  | { status: "loading" }
  | { status: "missing" }
  | {
      status: "ready";
      /** Frozen on first load (or last `apply()`) — NOT the rolling poll value. */
      snapshot: SessionDetail;
      /** Diff between `snapshot` and the freshest poll result. */
      updates: SessionUpdate[];
      /** Bumped on `apply()` so callers can re-key the player. */
      refreshTick: number;
      isApplying: boolean;
      apply: () => void;
    };

/**
 * Snapshot (local state) drives the player so rrweb gets a stable event
 * stream; the polled query cache surfaces a diff. `apply()` is wrapped in
 * `startTransition` because rrweb teardown+re-init is ~100-300ms on big
 * sessions — the refresh-button spinner appears before the main thread stalls.
 */
export function useSessionUpdateIndicator(sessionId: string): SessionUpdateIndicator {
  // No end-of-session cancellation — polls return identical data once `endedAt` lands, indicator stays dormant. Cheap at 10s cadence.
  const query = useSessionQuery(sessionId);
  const queryClient = useQueryClient();

  const [snapshot, setSnapshot] = useState<SessionDetail | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);
  const [isApplying, startTransition] = useTransition();

  // setState-during-render sentinel pattern — `useEffect` would need an extra
  // render trip and trip the new `react-hooks/set-state-in-effect` lint rule.
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
      // Events + markers are `staleTime: Infinity` — invalidate so the next load is fresh.
      void queryClient.invalidateQueries({ queryKey: sessionKeys.events(sessionId) });
      void queryClient.invalidateQueries({ queryKey: sessionKeys.markers(sessionId) });
    });
  }

  return { status: "ready", snapshot, updates, refreshTick, isApplying, apply };
}
