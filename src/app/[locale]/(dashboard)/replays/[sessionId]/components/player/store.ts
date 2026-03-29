import type { SessionEvent, SliceInfo } from "@/api-client/sessions/types";
import { create } from "zustand";
import type { PlayerState, ReplayerHandle } from "./types";

/**
 * Player store — Zustand root for rrweb playback state.
 *
 * @remarks
 * Zustand was chosen over React context + `useReducer` because the
 * store is read from five sibling components (`ControlBar`, `SeekBar`,
 * `SlicePicker`, `ConsolePanel`, `Viewport`) with wildly different
 * subscription patterns:
 *   - `SeekBar` polls `currentTime` at ~60 fps and MUST re-render on
 *      each tick, but must NOT re-render when unrelated state changes
 *      (e.g. the console panel toggling).
 *   - `ControlBar` re-renders on `state` / `speed` / `skipInactive` /
 *      `autoContinue` / `consoleOpen`, but not on `currentTime`.
 *   - `ConsolePanel` reads `events` + `currentTime`.
 *
 * Zustand + per-field selectors (or `useShallow` when multiple fields
 * are needed) give us precise subscription boundaries without a
 * provider tree. Consumers import {@link selectIsPlayerDisabled}
 * instead of re-deriving the "disabled while idle or mid-slice-load"
 * gate across components — single source of truth.
 *
 * Module-scoped `handle` and `rafId` keep the imperative rrweb
 * integration out of React state. The rrweb `Replayer` instance is not
 * a value React should own: it mutates on calls (play/pause/seek), not
 * on render, and its lifecycle is driven by the Viewport's effect, not
 * by rendering. The Viewport creates and destroys the Replayer; the
 * store just caches the handle so playback actions can reach it.
 *
 * @see ./viewport — Replayer instantiation + Shadow DOM isolation.
 * @see ./types — `PlayerState` union + `ReplayerHandle` interface.
 */

// ── Constants ──────────────────────────────────────────────────────────

/**
 * Gaps between consecutive events longer than this are marked as idle
 * periods on the seek bar (amber segments) and jumped past when
 * "Skip idle" is enabled.
 *
 * @remarks
 * 10 seconds is a product-level tuning knob: rrweb emits at least one
 * interaction event (mousemove, scroll, input) every few seconds
 * during active use, so a 10-second gap is an unambiguous signal the
 * user stopped interacting. Shorter thresholds (3-5 s) produce noisy
 * amber segments during normal reading; longer (30 s+) hides genuine
 * drop-offs from the timeline.
 */
const IDLE_THRESHOLD_MS = 10_000;

// ── Idle period detection ──────────────────────────────────────────────

export type IdlePeriod = { start: number; end: number };

/**
 * Scan an event array for gaps longer than {@link IDLE_THRESHOLD_MS}.
 *
 * @remarks
 * Times are expressed as offsets from the first event (milliseconds),
 * matching rrweb's internal timeline so `handle.getCurrentTime()` and
 * the returned boundaries share the same reference. Called once per
 * slice on `setEvents` — results are cached in the store rather than
 * recomputed per render.
 */
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

// ── Imperative state ───────────────────────────────────────────────────

/**
 * Module-scoped rrweb handle + current RAF id.
 *
 * @remarks
 * Deliberately NOT stored in Zustand state: the handle is a live
 * object reference that mutates in place and whose identity should
 * never be snapshotted into React rendering. `selectSlice` /
 * `onReplayerReady` are the only paths that reassign `handle` — every
 * other code path reads it. `rafId` is similar: it's a short-lived
 * integer whose only purpose is `cancelAnimationFrame`.
 *
 * Safety note: when the Viewport unmounts without `selectSlice` being
 * called first (e.g. page navigation), `handle` may linger pointing at
 * a destroyed Replayer. Every action that uses it either guards with
 * `if (!handle) return` or catches the "Replayer destroyed" throw
 * inside the RAF tick — there's no code path that can corrupt state
 * by touching a stale handle.
 */
let handle: ReplayerHandle | null = null;
let rafId = 0;

/**
 * Start per-frame polling of `handle.getCurrentTime()` so the store's
 * `currentTime` field tracks the replayer. Also handles the custom
 * skip-idle jump when the cursor lands inside an idle period.
 *
 * @remarks
 * We drive the store from the replayer (not the other way round) because
 * rrweb applies timing internally and we'd fight its clock if we tried
 * to scrub by setting `currentTime` from React state. A fresh RAF loop
 * replaces any previous one — `cancelAnimationFrame(rafId)` at the top
 * guarantees at most one active loop at a time. The try/catch swallows
 * the specific throw rrweb emits when the Replayer is destroyed mid-
 * frame (e.g. during slice switch), so a teardown race can't break the
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

// ── Store types ────────────────────────────────────────────────────────

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

  /**
   * Cross-mount bridge for the auto-continue flow.
   *
   * When `finish` fires and auto-continue is on, we bump
   * `activeSliceIndex` and set this flag. The Viewport subsequently
   * unmounts and remounts for the new slice, then calls
   * `onReplayerReady` — at which point we read the flag, auto-play
   * from t=0, and clear it. Without this bridge, the React render that
   * kicks off the new Viewport would have no way to know "start
   * playing immediately" vs. "wait for user to press play".
   */
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

// ── Store ──────────────────────────────────────────────────────────────

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

  // ── Replayer lifecycle ──────────────────────────────────────────

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
        // Tiny delay lets the "completed" state paint before the
        // Viewport tears down for the next slice — without it the user
        // sees the playhead snap back to 0 without ever reaching the
        // end, which reads as a skipped finish.
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

  // ── Playback controls ──────────────────────────────────────────

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

  // ── Preferences ────────────────────────────────────────────────

  setSpeed: (speed) => {
    handle?.setConfig({ speed });
    set({ speed });
  },

  toggleSkipInactive: () => set((s) => ({ skipInactive: !s.skipInactive })),
  toggleAutoContinue: () => set((s) => ({ autoContinue: !s.autoContinue })),

  // ── UI ─────────────────────────────────────────────────────────

  toggleConsole: () => set((s) => ({ consoleOpen: !s.consoleOpen })),

  // ── Slices ─────────────────────────────────────────────────────

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

// ── Selectors ──────────────────────────────────────────────────────────

/**
 * `true` while the player's transport controls should be disabled —
 * either no replayer is mounted yet (`state === "idle"`), or slice
 * events are still loading and the current replayer is about to be
 * replaced.
 *
 * @remarks
 * Lifted out of individual components so `ControlBar`, `SeekBar`, and
 * any future consumer share one disabled-gate definition. Using this
 * selector (rather than re-deriving inline) means adjusting the gate
 * — e.g. also disabling during refresh-button transitions — is a
 * one-line edit here.
 *
 * @example
 * ```ts
 * const isDisabled = usePlayerStore(selectIsPlayerDisabled);
 * ```
 */
export const selectIsPlayerDisabled = (s: PlayerStoreState) => s.state === "idle" || s.isSliceLoading;
