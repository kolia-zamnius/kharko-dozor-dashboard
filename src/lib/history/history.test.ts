import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { buildHistory, findActiveHistoryItemId } from "./index";
import type { DozorEvent } from "./types";

function event(timestamp: number, type = 3, data: unknown = {}): DozorEvent {
  return { type, timestamp, data };
}

function urlMarker(timestamp: number, pathname: string, url = `https://example.com${pathname}`): DozorEvent {
  return { type: 5, timestamp, data: { tag: "dozor:url", payload: { url, pathname } } };
}

function identityMarker(timestamp: number, userId: string, traits: Record<string, unknown> | null = null): DozorEvent {
  return { type: 5, timestamp, data: { tag: "dozor:identity", payload: { userId, traits } } };
}

describe("buildHistory", () => {
  it("returns empty array on empty input", () => {
    expect(buildHistory([], { idleGapMs: 60_000 })).toEqual([]);
  });

  it("returns one init section when no markers and no idle gaps", () => {
    const items = buildHistory([event(0), event(100), event(200)], { idleGapMs: null });
    expect(items).toHaveLength(1);
    expect(items[0]!.kind).toBe("init");
    expect(items[0]!.startedAt).toBe(0);
    expect(items[0]!.endedAt).toBe(200);
  });

  it("seeds the init section's pathname from initialUrl when no url marker fires", () => {
    const items = buildHistory([event(0), event(100)], {
      idleGapMs: null,
      initialUrl: "https://example.com/playground",
    });
    expect(items).toHaveLength(1);
    const init = items[0]!;
    expect(init.kind).toBe("init");
    if (init.kind !== "init") throw new Error("unreachable");
    expect(init.url).toBe("https://example.com/playground");
    expect(init.pathname).toBe("/playground");
  });

  it("opens a navigation section at every dozor:url marker", () => {
    const items = buildHistory(
      [event(0), urlMarker(100, "/home"), event(200), urlMarker(300, "/checkout"), event(400)],
      { idleGapMs: null },
    );
    const sections = items.filter((i) => i.kind === "init" || i.kind === "navigation");
    expect(sections).toHaveLength(3);
    expect(sections[0]!.kind).toBe("init");
    expect(sections[1]!.kind).toBe("navigation");
    expect(sections[2]!.kind).toBe("navigation");
    if (sections[1]!.kind !== "navigation") throw new Error("unreachable");
    if (sections[2]!.kind !== "navigation") throw new Error("unreachable");
    expect(sections[1]!.pathname).toBe("/home");
    expect(sections[2]!.pathname).toBe("/checkout");
  });

  it("seals each section at the next navigation moment", () => {
    const items = buildHistory([event(0), urlMarker(100, "/home"), event(200), urlMarker(500, "/next"), event(600)], {
      idleGapMs: null,
    });
    expect(items[0]!.endedAt).toBe(100);
    expect(items[1]!.endedAt).toBe(500);
    expect(items[2]!.endedAt).toBe(600);
  });

  it("uses sessionEndedAt to close the trailing section when provided", () => {
    const items = buildHistory([event(0), event(100)], {
      idleGapMs: null,
      sessionEndedAt: 5_000,
    });
    expect(items[0]!.endedAt).toBe(5_000);
  });

  it("emits an idle marker for gaps strictly greater than idleGapMs", () => {
    const items = buildHistory([event(0), event(1_000), event(70_000), event(70_500)], { idleGapMs: 60_000 });
    const idleMarkers = items.filter((i) => i.kind === "idle");
    expect(idleMarkers).toHaveLength(1);
    expect(idleMarkers[0]!.startedAt).toBe(1_000);
    expect(idleMarkers[0]!.endedAt).toBe(70_000);
  });

  it("does NOT emit an idle marker for a gap equal to threshold (strict greater-than)", () => {
    const items = buildHistory([event(0), event(60_000)], { idleGapMs: 60_000 });
    expect(items.filter((i) => i.kind === "idle")).toHaveLength(0);
  });

  it("emits a zero-duration identify point for dozor:identity markers", () => {
    const items = buildHistory([event(0), identityMarker(500, "u-1", { plan: "pro" }), event(1_000)], {
      idleGapMs: null,
    });
    const identify = items.find((i) => i.kind === "identify");
    expect(identify).toBeDefined();
    if (identify?.kind !== "identify") throw new Error("unreachable");
    expect(identify.startedAt).toBe(identify.endedAt);
    expect(identify.userId).toBe("u-1");
    expect(identify.traits).toEqual({ plan: "pro" });
  });

  it("identity marker does not seal the surrounding section", () => {
    const items = buildHistory([event(0), identityMarker(500, "u-1"), event(1_000)], { idleGapMs: null });
    const init = items.find((i) => i.kind === "init");
    if (!init || init.kind !== "init") throw new Error("unreachable");
    expect(init.endedAt).toBe(1_000);
  });

  it("skips malformed url markers (missing pathname or url)", () => {
    const malformed: DozorEvent = {
      type: 5,
      timestamp: 100,
      data: { tag: "dozor:url", payload: { url: "https://x" } },
    };
    const items = buildHistory([event(0), malformed, event(200)], { idleGapMs: null });
    expect(items.filter((i) => i.kind === "navigation")).toHaveLength(0);
  });

  it("skips identity markers without a userId", () => {
    const malformed: DozorEvent = {
      type: 5,
      timestamp: 100,
      data: { tag: "dozor:identity", payload: { traits: {} } },
    };
    const items = buildHistory([event(0), malformed, event(200)], { idleGapMs: null });
    expect(items.filter((i) => i.kind === "identify")).toHaveLength(0);
  });

  it("invariant — sections chain head-to-tail with no gaps", () => {
    fc.assert(
      fc.property(fc.array(fc.integer({ min: 0, max: 1_000_000 }), { minLength: 1, maxLength: 50 }), (timestamps) => {
        const events = timestamps.map((t) => event(t));
        const items = buildHistory(events, { idleGapMs: 60_000 });
        const sections = items.filter((i) => i.kind === "init" || i.kind === "navigation");
        for (let i = 1; i < sections.length; i++) {
          expect(sections[i]!.startedAt).toBeGreaterThanOrEqual(sections[i - 1]!.endedAt);
        }
      }),
    );
  });

  it("invariant — every section has startedAt <= endedAt", () => {
    fc.assert(
      fc.property(fc.array(fc.integer({ min: 0, max: 1_000_000 }), { minLength: 1, maxLength: 50 }), (timestamps) => {
        const events = timestamps.map((t) => event(t));
        const items = buildHistory(events, { idleGapMs: 60_000 });
        for (const item of items) {
          expect(item.endedAt).toBeGreaterThanOrEqual(item.startedAt);
        }
      }),
    );
  });
});

describe("findActiveHistoryItemId", () => {
  it("returns null on empty input", () => {
    expect(findActiveHistoryItemId([], 100)).toBeNull();
  });

  it("matches a section containing the timestamp", () => {
    const items = buildHistory([event(0), urlMarker(100, "/home"), event(500)], { idleGapMs: null });
    const init = items.find((i) => i.kind === "init")!;
    const nav = items.find((i) => i.kind === "navigation")!;
    expect(findActiveHistoryItemId(items, 50)).toBe(init.id);
    expect(findActiveHistoryItemId(items, 200)).toBe(nav.id);
  });

  it("prefers an idle marker over the surrounding section", () => {
    const items = buildHistory([event(0), event(70_000), event(70_500)], { idleGapMs: 60_000 });
    const idle = items.find((i) => i.kind === "idle")!;
    expect(findActiveHistoryItemId(items, 30_000)).toBe(idle.id);
  });

  it("never matches an identify marker (zero duration)", () => {
    const items = buildHistory([event(0), identityMarker(500, "u-1"), event(1_000)], { idleGapMs: null });
    const identify = items.find((i) => i.kind === "identify")!;
    expect(findActiveHistoryItemId(items, 500)).not.toBe(identify.id);
  });
});
