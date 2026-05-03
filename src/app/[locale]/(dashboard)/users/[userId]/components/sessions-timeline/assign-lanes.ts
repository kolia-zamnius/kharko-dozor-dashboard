import type { TimelineSession } from "@/api-client/tracked-users/types";

/** A session decorated with `[visualStart, visualEnd]` clamped to the chart window. */
export type LaneSession = TimelineSession & {
  /** Clamped to the window's `from` — used for rendering only. */
  visualStart: number;
  /** Clamped to the window's `to`, or `now` if the session is still open. */
  visualEnd: number;
};

/**
 * Greedy interval scheduling — input is already `startedAt`-sorted by
 * `/timeline`. Each session takes the first lane whose last `visualEnd` ≤
 * its start; otherwise opens a new lane. Produces minimum lanes.
 *
 * Open sessions (`endedAt: null`) use `windowEnd` for both overlap check and
 * visual end so they extend to the right edge.
 */
export function assignLanes(sessions: TimelineSession[], windowStart: number, windowEnd: number): LaneSession[][] {
  const lanes: LaneSession[][] = [];
  // Track each lane's last `visualEnd` for O(1) lookup vs scanning lane.at(-1).
  const laneEnds: number[] = [];

  for (const s of sessions) {
    const start = new Date(s.startedAt).getTime();
    const end = s.endedAt ? new Date(s.endedAt).getTime() : windowEnd;

    // Pre-window starts still get a bar — just clamped to the left edge.
    const visualStart = Math.max(start, windowStart);
    const visualEnd = Math.max(visualStart, Math.min(end, windowEnd));

    const placed: LaneSession = { ...s, visualStart, visualEnd };

    let reusableLane: LaneSession[] | null = null;
    let reusableIndex = -1;
    for (let i = 0; i < lanes.length; i++) {
      const laneEnd = laneEnds[i];
      const lane = lanes[i];
      if (lane && laneEnd !== undefined && laneEnd <= start) {
        reusableLane = lane;
        reusableIndex = i;
        break;
      }
    }

    if (reusableLane === null) {
      lanes.push([placed]);
      laneEnds.push(visualEnd);
    } else {
      reusableLane.push(placed);
      laneEnds[reusableIndex] = visualEnd;
    }
  }

  return lanes;
}
