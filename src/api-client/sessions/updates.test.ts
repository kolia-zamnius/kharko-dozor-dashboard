// Unit tests for `detectSessionUpdates` + `formatUpdateTooltip`.
//
// The discriminated-union return shape is the contract the refresh-button
// tooltip depends on. `fast-check` guards: monotonicity (no fake variant for
// non-increased counts) and the ended-only-on-transition invariant.

import { describe, expect, it } from "vitest";
import fc from "fast-check";

import { fakeTranslator } from "../../../tests/helpers/translator";
import { detectSessionUpdates, formatUpdateTooltip, type SessionUpdate } from "./updates";
import type { SessionDetail } from "./types";

function snapshot(overrides: Partial<SessionDetail> = {}): SessionDetail {
  return {
    id: "sess_1",
    externalId: "ext_1",
    projectId: "proj_1",
    projectName: "",
    trackedUserId: null,
    userId: null,
    userTraits: null,
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
    markers: [],
    ...overrides,
  } as SessionDetail;
}

describe("detectSessionUpdates", () => {
  it("returns an empty array for identical snapshots", () => {
    const s = snapshot();
    expect(detectSessionUpdates(s, s)).toEqual([]);
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

  it("composes events + ended in order", () => {
    const before = snapshot({ eventCount: 5, endedAt: null });
    const after = snapshot({ eventCount: 8, endedAt: "2025-06-01T00:05:00.000Z" });
    const updates = detectSessionUpdates(before, after);
    expect(updates.map((u) => u.type)).toEqual(["new-events", "ended"]);
  });

  it("never fabricates a variant for non-increased eventCount", () => {
    fc.assert(
      fc.property(fc.nat(1000), fc.nat(1000), (beforeEvents, afterEvents) => {
        const before = snapshot({ eventCount: beforeEvents });
        const after = snapshot({ eventCount: afterEvents });
        const updates = detectSessionUpdates(before, after);
        const hasEvents = updates.some((u) => u.type === "new-events");
        if (hasEvents && afterEvents <= beforeEvents) return false;
        return true;
      }),
    );
  });
});

describe("formatUpdateTooltip", () => {
  const t = fakeTranslator("replays.detail.updateTooltip") as unknown as Parameters<typeof formatUpdateTooltip>[1];

  it("returns null for an empty update list", () => {
    expect(formatUpdateTooltip([], t)).toBeNull();
  });

  it("joins multiple updates with comma + suffix tail", () => {
    const updates: SessionUpdate[] = [{ type: "new-events", count: 17 }, { type: "ended" }];
    const out = formatUpdateTooltip(updates, t);
    expect(out).toBe(
      "replays.detail.updateTooltip.newEvents, replays.detail.updateTooltip.ended • replays.detail.updateTooltip.suffix",
    );
  });

  it("renders the ended variant via the 'ended' key", () => {
    const updates: SessionUpdate[] = [{ type: "ended" }];
    const out = formatUpdateTooltip(updates, t);
    expect(out).toBe("replays.detail.updateTooltip.ended • replays.detail.updateTooltip.suffix");
  });
});
