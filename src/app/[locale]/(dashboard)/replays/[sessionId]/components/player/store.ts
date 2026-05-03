import type { SessionEvent, SliceInfo } from "@/api-client/sessions/types";
import { create } from "zustand";
import type { PlayerState, ReplayerHandle } from "./types";

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


/**
 * 10s — rrweb emits ≥1 event every few seconds during active use, so a 10s
 * gap is an unambiguous "stopped interacting" signal. 3-5s is noisy during
 * normal reading; 30s+ hides genuine drop-offs from the timeline.
 */
const IDLE_THRESHOLD_MS = 10_000;


export type IdlePeriod = { start: number; end: number };

/** Times are offsets from the first event (matches rrweb's internal timeline so `handle.getCurrentTime()` shares the reference). */
function computeIdlePeriods(events: SessionEvent[]): IdlePeriod[] {
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


/**
 * Live object refs whose identity should never enter React rendering.
 * Stale `handle` after Viewport unmount is safe — every action guards `if
 * (!handle) return` or catches the "Replayer destroyed" throw in the RAF tick.
 */
let handle: ReplayerHandle | null = null;
let rafId = 0;

/**
 * Store is driven FROM the replayer, not vice versa — rrweb applies timing
 * internally; setting `currentTime` from React would fight its clock. The
 * try/catch swallows rrweb's "Replayer destroyed" throw mid-frame (slice
 * switch teardown race).
 * render loop.
 */
function startPolling(set: (partial: Partial<PlayerStoreState>) => void, get: () => PlayerStoreState) {
  cancelAnimationFrame(rafId);
  const tick = () => {
    if (!handle) return;
    try {
      let time = Math.max(0, handle.getCurrentTime());

      // Custom skip idle: if currentTime lands in an idle zone, jump past it.
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
  // Playback
  state: PlayerState;
  currentTime: number;
  totalTime: number;

  // Slices
  activeSliceIndex: number;
  totalSlices: number;
  slices: SliceInfo[];

  // Data (synced from TanStack Query by Player)
  events: SessionEvent[];
  isSliceLoading: boolean;

  // Idle detection (computed from events)
  idlePeriods: IdlePeriod[];
  /** Timestamp of the first event (Unix ms) — used for real-time display. */
  sessionStartTimestamp: number;

  // Preferences
  speed: number;
  skipInactive: boolean;
  autoContinue: boolean;

  // UI
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
  setSlices: (slices: SliceInfo[]) => void;
  setEvents: (events: SessionEvent[]) => void;
  setSliceLoading: (loading: boolean) => void;
};


export const usePlayerStore = create<PlayerStoreState & PlayerStoreActions>()((set, get) => ({
  state: "idle" as PlayerState,
  currentTime: 0,
  totalTime: 0,
  activeSliceIndex: 0,
  totalSlices: 0,
  slices: [],
  events: [],
  isSliceLoading: false,
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
        // Delay so the "completed" frame paints before Viewport teardown —
        // without it the playhead snaps back to 0 and the finish reads as skipped.
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

  setEvents: (events) =>
    set({
      events,
      idlePeriods: computeIdlePeriods(events),
      sessionStartTimestamp: events[0]?.timestamp ?? 0,
    }),

  setSliceLoading: (isSliceLoading) => set({ isSliceLoading }),
}));


/** Single source of truth for the disabled-gate — adjusting it (e.g. during refresh transitions) is a one-line edit. */
export const selectIsPlayerDisabled = (s: PlayerStoreState) => s.state === "idle" || s.isSliceLoading;
