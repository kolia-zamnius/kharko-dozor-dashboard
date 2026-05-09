/**
 * Unit tests for sessions `domain/` parsers — date-range math + sort options.
 * Table-driven so "today" / "7d" / "30d" / "90d" share one test body. The
 * widest preset (`90d`) is anchored to `SESSION_RETENTION_MS`, so the
 * assertion pulls from the same constant — flipping retention updates both
 * places in lockstep.
 */

import { describe, expect, it } from "vitest";

import { SESSION_RETENTION_MS, SEVEN_DAYS_MS, THIRTY_DAYS_MS } from "@/lib/time";

import {
  DEFAULT_SESSION_DATE_RANGE,
  dateRangeToFrom,
  parseSessionDateRange,
  SESSION_DATE_RANGES,
  type SessionDateRange,
} from "./ranges";
import {
  DEFAULT_SESSION_LIST_SORT,
  DEFAULT_SESSION_LIST_SORT_DIR,
  parseSessionListSortBy,
  parseSessionListSortDir,
  SESSION_LIST_SORT_OPTIONS,
} from "./sort";

describe("dateRangeToFrom", () => {
  const now = new Date("2025-06-15T14:30:00.000Z");

  it("anchors 'today' to UTC midnight", () => {
    const from = dateRangeToFrom("today", now);
    expect(from.toISOString()).toBe("2025-06-15T00:00:00.000Z");
  });

  it.each<[SessionDateRange, number]>([
    ["7d", SEVEN_DAYS_MS],
    ["30d", THIRTY_DAYS_MS],
    ["90d", SESSION_RETENTION_MS],
  ])("subtracts the correct window for %s", (range, windowMs) => {
    const from = dateRangeToFrom(range, now);
    expect(now.getTime() - from.getTime()).toBe(windowMs);
  });

  it("uses the runtime `now` default when omitted", () => {
    // Sanity: two back-to-back calls produce a `from` within a second of
    // each other for the non-`today` presets. Can't assert exact equality
    // because `new Date()` between the two calls may advance by ms.
    const a = dateRangeToFrom("7d");
    const b = dateRangeToFrom("7d");
    expect(Math.abs(a.getTime() - b.getTime())).toBeLessThan(1_000);
  });
});

describe("parseSessionDateRange", () => {
  it.each(SESSION_DATE_RANGES)("narrows known literal '%s'", (range) => {
    expect(parseSessionDateRange(range)).toBe(range);
  });

  it("falls back to the default on invalid input", () => {
    expect(parseSessionDateRange("bogus")).toBe(DEFAULT_SESSION_DATE_RANGE);
    expect(parseSessionDateRange("")).toBe(DEFAULT_SESSION_DATE_RANGE);
    expect(parseSessionDateRange(null)).toBe(DEFAULT_SESSION_DATE_RANGE);
    expect(parseSessionDateRange(undefined)).toBe(DEFAULT_SESSION_DATE_RANGE);
  });
});

describe("parseSessionListSortBy", () => {
  it.each(SESSION_LIST_SORT_OPTIONS)("narrows known literal '%s'", (opt) => {
    expect(parseSessionListSortBy(opt)).toBe(opt);
  });

  it("falls back to the default on invalid input", () => {
    expect(parseSessionListSortBy("bogus")).toBe(DEFAULT_SESSION_LIST_SORT);
    expect(parseSessionListSortBy(null)).toBe(DEFAULT_SESSION_LIST_SORT);
  });
});

describe("parseSessionListSortDir", () => {
  it("narrows 'asc' to 'asc'", () => {
    expect(parseSessionListSortDir("asc")).toBe("asc");
  });

  it("falls back to the default for any other input", () => {
    expect(parseSessionListSortDir("desc")).toBe(DEFAULT_SESSION_LIST_SORT_DIR);
    expect(parseSessionListSortDir("bogus")).toBe(DEFAULT_SESSION_LIST_SORT_DIR);
    expect(parseSessionListSortDir(null)).toBe(DEFAULT_SESSION_LIST_SORT_DIR);
    expect(parseSessionListSortDir(undefined)).toBe(DEFAULT_SESSION_LIST_SORT_DIR);
  });
});
