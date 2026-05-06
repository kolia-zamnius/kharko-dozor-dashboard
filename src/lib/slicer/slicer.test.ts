import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { slice } from "./index";
import type { DozorEvent } from "./types";

function event(timestamp: number, type = 3, data: unknown = {}): DozorEvent {
  return { type, timestamp, data };
}

function urlMarker(timestamp: number, pathname: string, url = `https://example.com${pathname}`): DozorEvent {
  return { type: 5, timestamp, data: { tag: "dozor:url", payload: { url, pathname } } };
}

describe("slicer", () => {
  it("returns empty array on empty input", () => {
    expect(slice([], { byUrl: true, idleGapMs: 60_000 })).toEqual([]);
  });

  it("returns one slice when no criteria match", () => {
    const events = [event(0), event(100), event(200)];
    const slices = slice(events, { byUrl: false, idleGapMs: null });
    expect(slices).toHaveLength(1);
    expect(slices[0]!.events).toHaveLength(3);
    expect(slices[0]!.reason).toBe("init");
  });

  it("splits at every dozor:url marker when byUrl is true", () => {
    const events = [event(0), urlMarker(100, "/home"), event(200), urlMarker(300, "/checkout"), event(400)];
    const slices = slice(events, { byUrl: true, idleGapMs: null });
    expect(slices).toHaveLength(3);
    expect(slices[1]!.reason).toBe("url");
    expect(slices[1]!.pathname).toBe("/home");
    expect(slices[2]!.pathname).toBe("/checkout");
  });

  it("splits at gaps larger than idleGapMs", () => {
    const events = [event(0), event(1_000), event(70_000), event(70_500)];
    const slices = slice(events, { byUrl: false, idleGapMs: 60_000 });
    expect(slices).toHaveLength(2);
    expect(slices[1]!.reason).toBe("idle");
    expect(slices[0]!.events).toHaveLength(2);
    expect(slices[1]!.events).toHaveLength(2);
  });

  it("does not split when gap equals threshold (strict greater-than)", () => {
    const events = [event(0), event(60_000)];
    const slices = slice(events, { byUrl: false, idleGapMs: 60_000 });
    expect(slices).toHaveLength(1);
  });

  it("propagates the most recent url marker into later slices' pathname", () => {
    const events = [urlMarker(0, "/home"), event(100), event(70_000), event(70_500)];
    const slices = slice(events, { byUrl: false, idleGapMs: 60_000 });
    expect(slices).toHaveLength(2);
    expect(slices[0]!.pathname).toBe("/home");
    expect(slices[1]!.pathname).toBe("/home");
  });

  it("invariant — every event in input ends up in exactly one slice", () => {
    fc.assert(
      fc.property(fc.array(fc.integer({ min: 0, max: 1_000_000 }), { minLength: 1, maxLength: 100 }), (timestamps) => {
        const events = timestamps.map((t) => event(t));
        const slices = slice(events, { byUrl: true, idleGapMs: 60_000 });
        const totalEvents = slices.reduce((sum, s) => sum + s.events.length, 0);
        expect(totalEvents).toBe(events.length);
      }),
    );
  });

  it("invariant — slices are sorted by startedAt", () => {
    fc.assert(
      fc.property(fc.array(fc.integer({ min: 0, max: 1_000_000 }), { minLength: 2, maxLength: 50 }), (timestamps) => {
        const events = timestamps.map((t) => event(t));
        const slices = slice(events, { byUrl: false, idleGapMs: 30_000 });
        for (let i = 1; i < slices.length; i++) {
          expect(slices[i]!.startedAt).toBeGreaterThanOrEqual(slices[i - 1]!.startedAt);
        }
      }),
    );
  });

  it("invariant — no resulting slice contains a gap > idleGapMs", () => {
    fc.assert(
      fc.property(fc.array(fc.integer({ min: 0, max: 200_000 }), { minLength: 2, maxLength: 50 }), (timestamps) => {
        const events = timestamps.map((t) => event(t));
        const idleGapMs = 30_000;
        const slices = slice(events, { byUrl: false, idleGapMs });
        for (const s of slices) {
          for (let i = 1; i < s.events.length; i++) {
            const gap = s.events[i]!.timestamp - s.events[i - 1]!.timestamp;
            expect(gap).toBeLessThanOrEqual(idleGapMs);
          }
        }
      }),
    );
  });
});
