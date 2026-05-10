import { create } from "zustand";

import { findActiveHistoryItemId } from "@/lib/history";
import type { HistoryItem } from "@/lib/history/types";
import type { PlayerEvent, PlayerState, PlayerTab, ReplayerHandle } from "./types";

/**
 * Zustand (not Context+`useReducer`) for precise subscription boundaries — the seek bar
 * re-renders at ~60fps on `currentTime` ticks, the History tab re-renders only on
 * `activeHistoryItemId` changes. Per-field selectors achieve this without a provider tree.
 *
 * `handle` and `rafId` are module-scoped (outside Zustand) — the rrweb Replayer mutates on calls,
 * not on render, and React shouldn't own its lifecycle. Stale `handle` after Viewport unmount is
 * safe: every action guards `if (!handle) return` and the rAF tick catches the destroy throw.
 */

export type IdlePeriod = { start: number; end: number };

let handle: ReplayerHandle | null = null;
let rafId = 0;

function startPolling(set: (partial: Partial<PlayerStoreState>) => void, get: () => PlayerStoreState) {
  cancelAnimationFrame(rafId);
  const tick = () => {
    if (!handle) return;
    try {
      let time = Math.max(0, handle.getCurrentTime());

      const state = get();
      if (state.skipInactive) {
        for (const period of state.idlePeriods) {
          if (time >= period.start && time < period.end) {
            handle.play(period.end);
            time = period.end;
            break;
          }
        }
      }

      const nextActiveId = findActiveHistoryItemId(state.historyItems, state.sessionStartTimestamp + time);
      const idChanged = nextActiveId !== state.activeHistoryItemId;
      const timeChanged = time !== state.currentTime;
      // Skip the `set` entirely when nothing moved — every write notifies all subscribers, and a
      // rrweb stall (paused replay still polling) can otherwise hammer the seek bar at 60fps.
      if (idChanged && timeChanged) {
        set({ currentTime: time, activeHistoryItemId: nextActiveId });
      } else if (idChanged) {
        set({ activeHistoryItemId: nextActiveId });
      } else if (timeChanged) {
        set({ currentTime: time });
      }
    } catch {
      // Replayer destroyed mid-frame — next frame will early-return on `!handle`.
    }
    rafId = requestAnimationFrame(tick);
  };
  rafId = requestAnimationFrame(tick);
}

function stopPolling() {
  cancelAnimationFrame(rafId);
}

type PlayerStoreState = {
  state: PlayerState;
  currentTime: number;
  totalTime: number;

  events: PlayerEvent[];

  historyItems: HistoryItem[];
  activeHistoryItemId: string | null;

  idlePeriods: IdlePeriod[];
  /** First event's timestamp (Unix ms). For real-time display, not the rrweb-internal offset. */
  sessionStartTimestamp: number;

  speed: number;
  skipInactive: boolean;
  /** Cap idle gaps in the rrweb stream to a small fixed length so the seek bar is scrubbable. */
  compressIdle: boolean;
  /** Whether the History/Console side panel is rendered. Off → viewport takes the full width. */
  sidePanelVisible: boolean;

  activeTab: PlayerTab;
};

type PlayerStoreActions = {
  onReplayerReady: (h: ReplayerHandle) => void;
  play: () => void;
  pause: () => void;
  seek: (time: number) => void;
  setSpeed: (speed: number) => void;
  toggleSkipInactive: () => void;
  toggleCompressIdle: () => void;
  toggleSidePanel: () => void;
  setActiveTab: (tab: PlayerTab) => void;
  setEvents: (events: PlayerEvent[]) => void;
  setHistoryItems: (items: HistoryItem[]) => void;
  resetForSession: () => void;
};

export const usePlayerStore = create<PlayerStoreState & PlayerStoreActions>()((set, get) => ({
  state: "idle" as PlayerState,
  currentTime: 0,
  totalTime: 0,
  events: [],
  historyItems: [],
  activeHistoryItemId: null,
  idlePeriods: [],
  sessionStartTimestamp: 0,
  speed: 1,
  skipInactive: true,
  compressIdle: true,
  sidePanelVisible: true,
  activeTab: "history" as PlayerTab,

  onReplayerReady: (h) => {
    handle = h;
    let totalTime = 0;
    try {
      totalTime = h.getMetaData().totalTime;
    } catch {
      // Replayer may not have meta yet.
    }
    set({ state: "paused", currentTime: 0, totalTime });

    h.on("finish", () => {
      stopPolling();
      const { totalTime: tt } = get();
      set({ state: "finished", currentTime: tt });
    });
  },

  play: () => {
    if (!handle) return;
    const { currentTime, totalTime } = get();
    const time = currentTime >= totalTime ? 0 : currentTime;
    handle.play(time);
    set({ state: "playing" });
    startPolling(set, get);
  },

  pause: () => {
    handle?.pause();
    stopPolling();
    set({ state: "paused" });
  },

  seek: (time) => {
    const { totalTime, state: s, sessionStartTimestamp, historyItems } = get();
    const clamped = Math.max(0, Math.min(time, totalTime));
    const nextActiveId = findActiveHistoryItemId(historyItems, sessionStartTimestamp + clamped);
    if (s === "playing") {
      handle?.play(clamped);
      startPolling(set, get);
    } else {
      handle?.pause(clamped);
      set({
        currentTime: clamped,
        activeHistoryItemId: nextActiveId,
        ...(s === "finished" && clamped < totalTime ? { state: "paused" as const } : {}),
      });
    }
  },

  setSpeed: (speed) => {
    handle?.setConfig({ speed });
    set({ speed });
  },

  toggleSkipInactive: () => set((s) => ({ skipInactive: !s.skipInactive })),
  toggleCompressIdle: () => set((s) => ({ compressIdle: !s.compressIdle })),
  toggleSidePanel: () => set((s) => ({ sidePanelVisible: !s.sidePanelVisible })),

  setActiveTab: (tab) => set({ activeTab: tab }),

  setEvents: (events) =>
    set({
      events,
      sessionStartTimestamp: events[0]?.timestamp ?? 0,
    }),

  // Idle bands and the skip-inactive skipper share their data with the History feed — every idle
  // marker corresponds to one amber band, in compressed or raw timeline. Offsets resolve against
  // `sessionStartTimestamp`, settled by the preceding `setEvents` call (Player's useEffects fire
  // in declaration order).
  setHistoryItems: (items) => {
    const { sessionStartTimestamp, currentTime } = get();
    const idlePeriods: IdlePeriod[] = [];
    for (const item of items) {
      if (item.kind === "idle") {
        idlePeriods.push({
          start: item.startedAt - sessionStartTimestamp,
          end: item.endedAt - sessionStartTimestamp,
        });
      }
    }
    // Recompute against current playback position so live-session rebuilds (new batches arriving)
    // don't snap the active highlight back to the init item mid-play.
    const activeId = findActiveHistoryItemId(items, sessionStartTimestamp + currentTime);
    set({ historyItems: items, activeHistoryItemId: activeId, idlePeriods });
  },

  resetForSession: () => {
    stopPolling();
    handle = null;
    set({
      state: "idle",
      currentTime: 0,
      totalTime: 0,
      activeHistoryItemId: null,
    });
  },
}));

export const selectIsPlayerDisabled = (s: PlayerStoreState) => s.state === "idle" || s.events.length === 0;
