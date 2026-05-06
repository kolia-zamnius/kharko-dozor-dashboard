import { create } from "zustand";

import type { Slice } from "@/lib/slicer/types";
import type { PlayerEvent, PlayerState, ReplayerHandle } from "./types";

/**
 * Zustand (not Context+`useReducer`) for precise subscription boundaries —
 * SeekBar re-renders at ~60fps on `currentTime` but not on `consoleOpen`;
 * ControlBar is the inverse. Per-field selectors (or `useShallow`) achieve
 * this without a provider tree.
 *
 * Module-scoped `handle`/`rafId` are intentionally OUTSIDE Zustand — the
 * rrweb `Replayer` mutates on calls (play/pause/seek) not on render, its
 * lifecycle is driven by Viewport's effect. React shouldn't own it.
 */

// 10s — rrweb emits ≥1 event every few seconds during active use, so a 10s
// gap is an unambiguous "stopped interacting" signal. 3-5s is noisy during
// normal reading; 30s+ hides genuine drop-offs from the timeline.
const IDLE_THRESHOLD_MS = 10_000;

export type IdlePeriod = { start: number; end: number };

// Times are offsets from the first event (matches rrweb's internal timeline so
// `handle.getCurrentTime()` shares the reference).
function computeIdlePeriods(events: readonly PlayerEvent[]): IdlePeriod[] {
  const first = events[0];
  if (!first || events.length < 2) return [];
  const origin = first.timestamp;
  const periods: IdlePeriod[] = [];
  for (let i = 1; i < events.length; i++) {
    const prev = events[i - 1];
    const curr = events[i];
    if (!prev || !curr) continue;
    const gap = curr.timestamp - prev.timestamp;
    if (gap > IDLE_THRESHOLD_MS) {
      periods.push({
        start: prev.timestamp - origin,
        end: curr.timestamp - origin,
      });
    }
  }
  return periods;
}

// Live object refs whose identity should never enter React rendering.
// Stale `handle` after Viewport unmount is safe — every action guards `if
// (!handle) return` or catches the "Replayer destroyed" throw in the RAF tick.
let handle: ReplayerHandle | null = null;
let rafId = 0;

function startPolling(set: (partial: Partial<PlayerStoreState>) => void, get: () => PlayerStoreState) {
  cancelAnimationFrame(rafId);
  const tick = () => {
    if (!handle) return;
    try {
      let time = Math.max(0, handle.getCurrentTime());

      const { skipInactive, idlePeriods } = get();
      if (skipInactive) {
        for (const period of idlePeriods) {
          if (time >= period.start && time < period.end) {
            handle.play(period.end);
            time = period.end;
            break;
          }
        }
      }

      set({ currentTime: time });
    } catch {
      // Replayer destroyed mid-frame — swallow, next frame will early-return.
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

  activeSliceIndex: number;
  totalSlices: number;
  slices: Slice[];

  events: PlayerEvent[];

  idlePeriods: IdlePeriod[];
  /** Timestamp of the first event (Unix ms) — for real-time display, not the rrweb-internal offset clock. */
  sessionStartTimestamp: number;

  speed: number;
  skipInactive: boolean;
  autoContinue: boolean;

  consoleOpen: boolean;

  /** Cross-mount bridge — set on finish+auto-continue, read by `onReplayerReady` after the new Viewport mounts to decide auto-play vs paused. */
  pendingAutoPlay: boolean;
};

type PlayerStoreActions = {
  onReplayerReady: (h: ReplayerHandle) => void;
  play: () => void;
  pause: () => void;
  seek: (time: number) => void;
  setSpeed: (speed: number) => void;
  toggleSkipInactive: () => void;
  toggleAutoContinue: () => void;
  toggleConsole: () => void;
  selectSlice: (index: number) => void;
  setSlices: (slices: Slice[]) => void;
  setActiveSliceEvents: (events: PlayerEvent[]) => void;
};

export const usePlayerStore = create<PlayerStoreState & PlayerStoreActions>()((set, get) => ({
  state: "idle" as PlayerState,
  currentTime: 0,
  totalTime: 0,
  activeSliceIndex: 0,
  totalSlices: 0,
  slices: [],
  events: [],
  idlePeriods: [],
  sessionStartTimestamp: 0,
  speed: 1,
  skipInactive: true,
  autoContinue: false,
  consoleOpen: false,
  pendingAutoPlay: false,

  onReplayerReady: (h) => {
    handle = h;
    let totalTime = 0;
    try {
      totalTime = h.getMetaData().totalTime;
    } catch {
      // Replayer may not have meta yet.
    }

    const { pendingAutoPlay } = get();
    if (pendingAutoPlay) {
      h.play(0);
      set({ state: "playing", currentTime: 0, totalTime, pendingAutoPlay: false });
      startPolling(set, get);
    } else {
      set({ state: "paused", currentTime: 0, totalTime });
    }

    h.on("finish", () => {
      stopPolling();
      const { autoContinue, activeSliceIndex, totalSlices, totalTime: tt } = get();

      if (autoContinue && totalSlices > 0 && activeSliceIndex < totalSlices - 1) {
        set({ currentTime: tt });
        setTimeout(() => {
          stopPolling();
          handle = null;
          set({
            state: "idle",
            currentTime: 0,
            totalTime: 0,
            activeSliceIndex: activeSliceIndex + 1,
            pendingAutoPlay: true,
          });
        }, 500);
      } else {
        set({ state: "finished", currentTime: tt });
      }
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
    const { totalTime, state: s } = get();
    const clamped = Math.max(0, Math.min(time, totalTime));
    if (s === "playing") {
      handle?.play(clamped);
      startPolling(set, get);
    } else {
      handle?.pause(clamped);
      set({
        currentTime: clamped,
        ...(s === "finished" && clamped < totalTime ? { state: "paused" as const } : {}),
      });
    }
  },

  setSpeed: (speed) => {
    handle?.setConfig({ speed });
    set({ speed });
  },

  toggleSkipInactive: () => set((s) => ({ skipInactive: !s.skipInactive })),
  toggleAutoContinue: () => set((s) => ({ autoContinue: !s.autoContinue })),

  toggleConsole: () => set((s) => ({ consoleOpen: !s.consoleOpen })),

  selectSlice: (index) => {
    stopPolling();
    handle = null;
    set({ state: "idle", currentTime: 0, totalTime: 0, activeSliceIndex: index, pendingAutoPlay: false });
  },

  setSlices: (slices) => set({ slices, totalSlices: slices.length }),

  setActiveSliceEvents: (events) =>
    set({
      events,
      idlePeriods: computeIdlePeriods(events),
      sessionStartTimestamp: events[0]?.timestamp ?? 0,
    }),
}));

export const selectIsPlayerDisabled = (s: PlayerStoreState) => s.state === "idle" || s.events.length === 0;
