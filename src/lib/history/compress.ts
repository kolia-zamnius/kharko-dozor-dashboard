import type { DozorEvent } from "./types";

/**
 * Caps every idle gap > `gapThresholdMs` to exactly `capMs`, shifting subsequent events earlier
 * by the cumulative amount removed. `mapToCompressed` translates a timestamp from the original
 * timeline to its compressed position — used to remap history items so seek + highlight align
 * with the compressed Replayer clock.
 */
export function compressIdleEvents(
  events: readonly DozorEvent[],
  gapThresholdMs: number,
  capMs: number,
): { events: DozorEvent[]; mapToCompressed: (originalMs: number) => number } {
  if (events.length === 0) {
    return { events: [], mapToCompressed: (t) => t };
  }

  const sorted = [...events].sort((a, b) => a.timestamp - b.timestamp);
  const compressed: DozorEvent[] = [{ ...sorted[0]! }];
  const ranges: Array<{ origStart: number; origEnd: number; compStart: number }> = [];
  let shift = 0;

  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1]!;
    const curr = sorted[i]!;
    const gap = curr.timestamp - prev.timestamp;
    if (gap > gapThresholdMs) {
      ranges.push({
        origStart: prev.timestamp,
        origEnd: curr.timestamp,
        compStart: prev.timestamp - shift,
      });
      shift += gap - capMs;
    }
    compressed.push({ ...curr, timestamp: curr.timestamp - shift });
  }

  const mapToCompressed = (originalMs: number): number => {
    let s = 0;
    for (const r of ranges) {
      if (originalMs > r.origEnd) {
        s += r.origEnd - r.origStart - capMs;
      } else if (originalMs >= r.origStart) {
        // Mid-gap → interpolate proportionally; boundaries land on compStart / compStart + capMs.
        const dur = Math.max(1, r.origEnd - r.origStart);
        const ratio = (originalMs - r.origStart) / dur;
        return r.compStart + ratio * capMs;
      } else {
        break;
      }
    }
    return originalMs - s;
  };

  return { events: compressed, mapToCompressed };
}
