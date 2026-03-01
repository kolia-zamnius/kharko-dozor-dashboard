/**
 * Unit tests for `deriveUserStatus` + `parseUserStatus`.
 *
 * @remarks
 * The `deriveUserStatus` boundary math is the kind of function where a
 * flipped `<` vs `<=` is invisible to the type system but visible to a
 * user whose last event was "2 minutes ago exactly". `fast-check`
 * property-tests the invariant that every valid input produces a bucket
 * in the declared union — no matter how wild the date.
 */

import { describe, expect, it } from "vitest";
import fc from "fast-check";

import { deriveUserStatus, parseUserStatus, USER_ACTIVITY_STATUSES, STATUS_THRESHOLDS_MS } from "./status";

describe("deriveUserStatus", () => {
  const now = new Date("2025-06-01T12:00:00.000Z");

  it("returns DORMANT when lastEventAt is null", () => {
    expect(deriveUserStatus(null, now)).toBe("DORMANT");
  });

  it("returns ONLINE at the exact threshold boundary (inclusive)", () => {
    const at = new Date(now.getTime() - STATUS_THRESHOLDS_MS.ONLINE);
    expect(deriveUserStatus(at, now)).toBe("ONLINE");
  });

  it("returns ACTIVE_24H just past the ONLINE threshold", () => {
    const at = new Date(now.getTime() - STATUS_THRESHOLDS_MS.ONLINE - 1);
    expect(deriveUserStatus(at, now)).toBe("ACTIVE_24H");
  });

  it("returns ACTIVE_24H at the 24h boundary", () => {
    const at = new Date(now.getTime() - STATUS_THRESHOLDS_MS.ACTIVE_24H);
    expect(deriveUserStatus(at, now)).toBe("ACTIVE_24H");
  });

  it("returns IDLE_7D just past 24h", () => {
    const at = new Date(now.getTime() - STATUS_THRESHOLDS_MS.ACTIVE_24H - 1);
    expect(deriveUserStatus(at, now)).toBe("IDLE_7D");
  });

  it("returns IDLE_7D at the 7-day boundary", () => {
    const at = new Date(now.getTime() - STATUS_THRESHOLDS_MS.IDLE_7D);
    expect(deriveUserStatus(at, now)).toBe("IDLE_7D");
  });

  it("returns DORMANT past the 7-day boundary", () => {
    const at = new Date(now.getTime() - STATUS_THRESHOLDS_MS.IDLE_7D - 1);
    expect(deriveUserStatus(at, now)).toBe("DORMANT");
  });

  it("accepts ISO strings and Date instances equivalently", () => {
    const at = new Date(now.getTime() - 1_000);
    expect(deriveUserStatus(at, now)).toBe(deriveUserStatus(at.toISOString(), now));
  });

  // fast-check property: no matter how unhinged the elapsed offset, the
  // result is always one of the four declared buckets. Catches a silent
  // regression where someone adds a new threshold without extending the
  // union.
  it("returns a value inside USER_ACTIVITY_STATUSES for any elapsed time", () => {
    fc.assert(
      fc.property(
        // Any finite millisecond offset — past, future (future clamps to ONLINE).
        fc.integer({ min: -1_000_000, max: 100 * 24 * 60 * 60 * 1000 }),
        (offsetMs) => {
          const at = new Date(now.getTime() - offsetMs);
          const status = deriveUserStatus(at, now);
          return (USER_ACTIVITY_STATUSES as readonly string[]).includes(status);
        },
      ),
    );
  });
});

describe("parseUserStatus", () => {
  it("narrows known enum literals", () => {
    expect(parseUserStatus("ONLINE")).toBe("ONLINE");
    expect(parseUserStatus("DORMANT")).toBe("DORMANT");
  });

  it("returns null for anything outside the union", () => {
    expect(parseUserStatus("online")).toBeNull(); // case-sensitive
    expect(parseUserStatus("unknown")).toBeNull();
    expect(parseUserStatus("")).toBeNull();
  });
});
