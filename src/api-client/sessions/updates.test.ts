/**
 * Unit tests for `detectSessionUpdates` + `formatUpdateTooltip`.
 *
 * @remarks
 * The discriminated-union return shape is the contract the refresh-button
 * tooltip depends on. `fast-check` guards the invariants:
 *   - No variant appears for a snapshot that exactly matches the latest.
 *   - `ended` variant ONLY appears on null → non-null transitions
 *     (mid-session snapshot diffs that happen to carry the same `endedAt`
 *     don't trigger it).
 */

import { describe, expect, it } from "vitest";
import fc from "fast-check";

import { fakeTranslator } from "../../../tests/helpers/translator";
import { detectSessionUpdates, formatUpdateTooltip, type SessionUpdate } from "./updates";
import type { SessionDetail } from "./types";

// Minimal `SessionDetail` factory. We only care about the fields
// `detectSessionUpdates` reads; the rest are filled with null/empty.
function snapshot(overrides: Partial<SessionDetail> = {}): SessionDetail {
  return {
    id: "sess_1",
    externalId: "ext_1",
    projectId: "proj_1",
    projectName: null,
    trackedUserId: null,
    userDisplayName: null,
    userExternalId: null,
    url: null,
    userAgent: null,
    screenWidth: null,
    screenHeight: null,
    language: null,
    startedAt: "2025-06-01T00:00:00.000Z",
    endedAt: null,
    duration: 0,
    eventCount: 0,
    createdAt: "2025-06-01T00:00:00.000Z",
    slices: [],
    ...overrides,
  } as SessionDetail;
}

describe("detectSessionUpdates", () => {
  it("returns an empty array for identical snapshots", () => {
    const s = snapshot();
    expect(detectSessionUpdates(s, s)).toEqual([]);
  });

  it("reports new-slices with the exact delta", () => {
    const before = snapshot({ slices: [{ index: 0 }] as SessionDetail["slices"] });
    const after = snapshot({ slices: [{ index: 0 }, { index: 1 }, { index: 2 }] as SessionDetail["slices"] });
    expect(detectSessionUpdates(before, after)).toEqual([{ type: "new-slices", count: 2 }]);
  });

  it("reports new-events with the exact delta", () => {
    const before = snapshot({ eventCount: 10 });
    const after = snapshot({ eventCount: 27 });
    expect(detectSessionUpdates(before, after)).toEqual([{ type: "new-events", count: 17 }]);
  });

  it("reports ended only on null → non-null endedAt transition", () => {
    const live = snapshot({ endedAt: null });
    const ended = snapshot({ endedAt: "2025-06-01T00:05:00.000Z" });
    expect(detectSessionUpdates(live, ended)).toContainEqual({ type: "ended" });
  });

  it("does NOT report ended when the snapshot already carried an endedAt", () => {
    const before = snapshot({ endedAt: "2025-06-01T00:05:00.000Z" });
    const after = snapshot({ endedAt: "2025-06-01T00:10:00.000Z" });
    expect(detectSessionUpdates(before, after)).not.toContainEqual({ type: "ended" });
  });

  it("composes multiple variants in priority order (slices → events → ended)", () => {
    const before = snapshot({ slices: [], eventCount: 5, endedAt: null });
    const after = snapshot({
      slices: [{ index: 0 }] as SessionDetail["slices"],
      eventCount: 8,
      endedAt: "2025-06-01T00:05:00.000Z",
    });
    const updates = detectSessionUpdates(before, after);
    expect(updates.map((u) => u.type)).toEqual(["new-slices", "new-events", "ended"]);
  });

  // Property: `detectSessionUpdates` never surfaces a variant for a
  // field that didn't change forward. Monotonicity invariant — regressing
  // counts (impossible in production since the server only appends)
  // must not produce spurious updates.
  it("never fabricates a variant for non-increased counts", () => {
    fc.assert(
      fc.property(
        fc.nat(100),
        fc.nat(100),
        fc.nat(1000),
        fc.nat(1000),
        (beforeSlices, afterSlices, beforeEvents, afterEvents) => {
          const before = snapshot({
            slices: Array.from({ length: beforeSlices }, (_, i) => ({ index: i })) as SessionDetail["slices"],
            eventCount: beforeEvents,
          });
          const after = snapshot({
            slices: Array.from({ length: afterSlices }, (_, i) => ({ index: i })) as SessionDetail["slices"],
            eventCount: afterEvents,
          });
          const updates = detectSessionUpdates(before, after);
          const hasSlices = updates.some((u) => u.type === "new-slices");
          const hasEvents = updates.some((u) => u.type === "new-events");
          if (hasSlices && afterSlices <= beforeSlices) return false;
          if (hasEvents && afterEvents <= beforeEvents) return false;
          return true;
        },
      ),
    );
  });
});

describe("formatUpdateTooltip", () => {
  const t = fakeTranslator("replays.detail.updateTooltip") as unknown as Parameters<typeof formatUpdateTooltip>[1];

  it("returns null for an empty update list", () => {
    expect(formatUpdateTooltip([], t)).toBeNull();
  });

  it("joins multiple updates with comma + suffix tail", () => {
    const updates: SessionUpdate[] = [
      { type: "new-slices", count: 2 },
      { type: "new-events", count: 17 },
    ];
    const out = formatUpdateTooltip(updates, t);
    // fakeTranslator echoes "namespace.key", so each part is a
    // predictable string. Suffix separator is the bullet + space.
    expect(out).toBe(
      "replays.detail.updateTooltip.newSlices, replays.detail.updateTooltip.newEvents • replays.detail.updateTooltip.suffix",
    );
  });

  it("renders the ended variant via the 'ended' key", () => {
    const updates: SessionUpdate[] = [{ type: "ended" }];
    const out = formatUpdateTooltip(updates, t);
    expect(out).toBe("replays.detail.updateTooltip.ended • replays.detail.updateTooltip.suffix");
  });
});
