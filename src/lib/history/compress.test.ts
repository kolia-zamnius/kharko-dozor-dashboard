import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { compressIdleEvents } from "./compress";
import type { DozorEvent } from "./types";

function event(timestamp: number, type = 3, data: unknown = {}): DozorEvent {
  return { type, timestamp, data };
}

describe("compressIdleEvents", () => {
  it("returns empty events + identity map for empty input", () => {
    const result = compressIdleEvents([], 30_000, 5_000);
    expect(result.events).toEqual([]);
    expect(result.mapToCompressed(123)).toBe(123);
  });

  it("returns the events untouched when no gap exceeds the threshold", () => {
    const events = [event(0), event(1_000), event(2_000)];
    const result = compressIdleEvents(events, 30_000, 5_000);
    expect(result.events.map((e) => e.timestamp)).toEqual([0, 1_000, 2_000]);
    expect(result.mapToCompressed(1_500)).toBe(1_500);
  });

  it("compresses a single idle gap to exactly capMs and shifts subsequent events", () => {
    const events = [event(0), event(1_000), event(1_000_000), event(1_001_000)];
    const result = compressIdleEvents(events, 30_000, 5_000);
    // gap from 1_000 to 1_000_000 was 999_000; cap to 5_000; subsequent events shift by 994_000.
    expect(result.events.map((e) => e.timestamp)).toEqual([0, 1_000, 6_000, 7_000]);
  });

  it("compresses multiple idle gaps cumulatively", () => {
    const events = [event(0), event(100_000), event(200_000), event(1_200_000)];
    // gap1: 0 → 100_000 (100k > 30k, cap to 5k, removed = 95k)
    // gap2: 100_000 → 200_000 (100k > 30k, cap to 5k, removed = 95k)
    // gap3: 200_000 → 1_200_000 (1M > 30k, cap to 5k, removed = 995k)
    const result = compressIdleEvents(events, 30_000, 5_000);
    expect(result.events.map((e) => e.timestamp)).toEqual([0, 5_000, 10_000, 15_000]);
  });

  it("does not compress a gap exactly equal to threshold (strict greater-than)", () => {
    const events = [event(0), event(30_000)];
    const result = compressIdleEvents(events, 30_000, 5_000);
    expect(result.events.map((e) => e.timestamp)).toEqual([0, 30_000]);
  });

  it("mapToCompressed returns identity for timestamps before any compressed range", () => {
    const events = [event(0), event(1_000), event(1_000_000)];
    const { mapToCompressed } = compressIdleEvents(events, 30_000, 5_000);
    expect(mapToCompressed(500)).toBe(500);
    expect(mapToCompressed(1_000)).toBe(1_000);
  });

  it("mapToCompressed lands cleanly on compressed gap boundaries", () => {
    const events = [event(0), event(1_000), event(1_000_000)];
    const { mapToCompressed } = compressIdleEvents(events, 30_000, 5_000);
    // gap from 1_000 to 1_000_000 → compressed [1_000, 6_000]
    expect(mapToCompressed(1_000)).toBe(1_000);
    expect(mapToCompressed(1_000_000)).toBe(6_000);
  });

  it("mapToCompressed interpolates inside an idle gap", () => {
    const events = [event(0), event(1_000), event(1_000_000)];
    const { mapToCompressed } = compressIdleEvents(events, 30_000, 5_000);
    // halfway through the original gap (500_500) → halfway through the 5 s compressed window
    const midOriginal = 1_000 + (1_000_000 - 1_000) / 2;
    const midCompressed = mapToCompressed(midOriginal);
    expect(midCompressed).toBeCloseTo(1_000 + 2_500, 5);
  });

  it("mapToCompressed accumulates shift for timestamps past multiple compressed gaps", () => {
    const events = [event(0), event(100_000), event(200_000), event(1_200_000)];
    const { mapToCompressed } = compressIdleEvents(events, 30_000, 5_000);
    // 200_000 sits at the end of gap2 → compressed 10_000. After gap2, shift = 95k + 95k = 190k.
    // 1_000_000 is past the end of gap2 (origEnd = 200_000) and before gap3 origEnd (1_200_000)
    // — falls inside gap3. After applying gap3 ratio: ratio = (1_000_000 - 200_000) / 1_000_000 = 0.8
    // → compStart3 + 0.8 * 5_000 where compStart3 = 200_000 - 190_000 = 10_000 → 10_000 + 4_000 = 14_000.
    expect(mapToCompressed(200_000)).toBe(10_000);
    expect(mapToCompressed(1_000_000)).toBeCloseTo(14_000, 5);
    expect(mapToCompressed(1_200_000)).toBe(15_000);
  });

  it("does not mutate the input array", () => {
    const events = [event(0), event(1_000), event(1_000_000)];
    const snapshot = events.map((e) => ({ ...e }));
    compressIdleEvents(events, 30_000, 5_000);
    expect(events).toEqual(snapshot);
  });

  it("invariant — no compressed gap exceeds capMs", () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 0, max: 10_000_000 }), { minLength: 2, maxLength: 50 }),
        fc.integer({ min: 1_000, max: 60_000 }),
        fc.integer({ min: 100, max: 5_000 }),
        (timestamps, threshold, cap) => {
          const events = timestamps.map((t) => event(t));
          const result = compressIdleEvents(events, threshold, cap);
          for (let i = 1; i < result.events.length; i++) {
            const gap = result.events[i]!.timestamp - result.events[i - 1]!.timestamp;
            // Only gaps that the caller would have flagged as idle (> threshold) get capped; gaps
            // already <= threshold pass through unchanged. The post-condition: every gap is either
            // unchanged-and-<=-threshold or capped-and-==-cap.
            expect(gap <= threshold || gap === cap).toBe(true);
          }
        },
      ),
    );
  });

  it("invariant — first event's compressed timestamp equals its original", () => {
    fc.assert(
      fc.property(fc.array(fc.integer({ min: 0, max: 10_000_000 }), { minLength: 1, maxLength: 50 }), (timestamps) => {
        const events = timestamps.map((t) => event(t));
        const result = compressIdleEvents(events, 30_000, 5_000);
        if (result.events.length === 0) return;
        const firstOriginal = [...timestamps].sort((a, b) => a - b)[0]!;
        expect(result.events[0]!.timestamp).toBe(firstOriginal);
      }),
    );
  });
});
