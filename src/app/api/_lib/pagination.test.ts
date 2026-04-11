/**
 * Unit tests for `parseLimitParam` + `buildCursorResponse`.
 *
 * @remarks
 * Defense-in-depth: routes often run `parseLimitParam` after a zod schema
 * already clamped `limit` to `[1, 100]`, but a handful of routes read
 * `searchParams.get("limit")` directly. Both paths must produce the same
 * output.
 */

import { describe, expect, it } from "vitest";

import { DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT } from "./constants";
import { buildCursorResponse, parseLimitParam } from "./pagination";

describe("parseLimitParam", () => {
  it("returns the default for missing input", () => {
    expect(parseLimitParam(undefined)).toBe(DEFAULT_PAGE_LIMIT);
    expect(parseLimitParam(null)).toBe(DEFAULT_PAGE_LIMIT);
    expect(parseLimitParam("")).toBe(DEFAULT_PAGE_LIMIT);
  });

  it("returns the default for non-numeric input", () => {
    expect(parseLimitParam("abc")).toBe(DEFAULT_PAGE_LIMIT);
    expect(parseLimitParam("NaN")).toBe(DEFAULT_PAGE_LIMIT);
  });

  it("returns the default for zero or negative numbers", () => {
    expect(parseLimitParam(0)).toBe(DEFAULT_PAGE_LIMIT);
    expect(parseLimitParam(-5)).toBe(DEFAULT_PAGE_LIMIT);
    expect(parseLimitParam("-5")).toBe(DEFAULT_PAGE_LIMIT);
  });

  it("accepts numeric strings and numbers equivalently", () => {
    expect(parseLimitParam("50")).toBe(50);
    expect(parseLimitParam(50)).toBe(50);
  });

  it("floors fractional values", () => {
    expect(parseLimitParam(4.9)).toBe(4);
    expect(parseLimitParam("4.9")).toBe(4);
  });

  it("clamps to MAX_PAGE_LIMIT", () => {
    expect(parseLimitParam(1_000)).toBe(MAX_PAGE_LIMIT);
    expect(parseLimitParam("9999")).toBe(MAX_PAGE_LIMIT);
  });
});

describe("buildCursorResponse", () => {
  type Row = { id: string; label: string };

  it("returns all rows + null cursor when the page isn't full", () => {
    const rows: Row[] = [
      { id: "r1", label: "a" },
      { id: "r2", label: "b" },
    ];
    const out = buildCursorResponse(rows, 10, "id");
    expect(out.data).toEqual(rows);
    expect(out.nextCursor).toBeNull();
  });

  it("slices off the over-fetch row and surfaces the cursor", () => {
    // Caller fetched with `take: limit + 1 = 3`, got 3 rows → next page exists.
    const rows: Row[] = [
      { id: "r1", label: "a" },
      { id: "r2", label: "b" },
      { id: "r3", label: "c" },
    ];
    const out = buildCursorResponse(rows, 2, "id");
    expect(out.data).toEqual([rows[0], rows[1]]);
    expect(out.nextCursor).toBe("r2");
  });

  it("returns empty data + null cursor when there are no rows", () => {
    const out = buildCursorResponse<Row, "id">([], 20, "id");
    expect(out.data).toEqual([]);
    expect(out.nextCursor).toBeNull();
  });

  it("type-parameterises the cursor field at compile time", () => {
    // This isn't a runtime assertion — the point is that `"label"` is
    // accepted as a keyof Row, and the return type carries `string | null`.
    // A typo like `"idd"` would fail `tsc` at the call site.
    const rows: Row[] = [{ id: "r1", label: "first" }];
    const out = buildCursorResponse(rows, 1, "label");
    expect(out.nextCursor).toBeNull();
  });
});
