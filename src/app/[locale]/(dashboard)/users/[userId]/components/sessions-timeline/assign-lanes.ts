import type { TimelineSession } from "@/api-client/tracked-users/types";

/** A session decorated with `[visualStart, visualEnd]` clamped to the chart window. */
export type LaneSession = TimelineSession & {
  /** Clamped to the window's `from` — used for rendering only. */
  visualStart: number;
  /** Clamped to the window's `to`, or `now` if the session is still open. */
  visualEnd: number;
};

/**
 * Greedy interval-scheduling lane assignment for the sessions timeline.
 *
 * Input is already `startedAt`-sorted by the `/timeline` endpoint. For each
 * session we find the first lane whose last-placed session ended no later
 * than the current session's start — that lane is reusable. If no lane is
 * reusable, we open a new one. This produces the minimum number of lanes,
 * which is the optimal vertical footprint for the chart.
 *
 * Open sessions (`endedAt: null`) use `windowEnd` as their effective end
 * both for the overlap check and for visual rendering, so a still-active
 * session extends to the right edge of the chart.
 *
 * Pure function — colocated with its only consumer (`SessionsTimeline`)
 * so the render file stays focused on layout and the scheduling algorithm
 * can be tested in isolation if we ever add tests.
 */
export function assignLanes(sessions: TimelineSession[], windowStart: number, windowEnd: number): LaneSession[][] {
  const lanes: LaneSession[][] = [];
  // Track the `visualEnd` of the last session in each lane for O(1) lookup.
  const laneEnds: number[] = [];

  for (const s of sessions) {
    const start = new Date(s.startedAt).getTime();
    const end = s.endedAt ? new Date(s.endedAt).getTime() : windowEnd;

    // Clamp to window for rendering — sessions that started before the
    // window opened still get a bar, it just begins at the left edge.
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
