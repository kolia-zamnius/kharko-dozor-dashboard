import "server-only";

import { DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT } from "./constants";

/**
 * Parse a `?limit=` value into a safe integer clamped to `[1, MAX_PAGE_LIMIT]`.
 *
 * @remarks
 * Accepts either a raw string (from `URLSearchParams.get`) or a pre-parsed
 * number (from a zod-validated params object) — both call sites exist in
 * the codebase. Defense-in-depth relative to zod: zod schemas already cap
 * `limit` at 100, but this helper also handles routes that bypass the
 * schema (direct `searchParams.get`) and normalises missing / invalid input.
 *
 * Behaviour:
 *   - missing / empty / `null` → {@link DEFAULT_PAGE_LIMIT}
 *   - non-numeric / `<= 0` / `NaN` → {@link DEFAULT_PAGE_LIMIT}
 *   - numeric above cap → {@link MAX_PAGE_LIMIT}
 *   - fractional → floored
 *
 * @param raw - Limit value from query params or a validated schema.
 * @returns Integer in `[1, MAX_PAGE_LIMIT]`.
 *
 * @example
 * parseLimitParam("50");        // → 50
 * parseLimitParam("invalid");   // → DEFAULT_PAGE_LIMIT
 * parseLimitParam(200);         // → MAX_PAGE_LIMIT
 * parseLimitParam(null);        // → DEFAULT_PAGE_LIMIT
 */
export function parseLimitParam(raw: string | number | null | undefined): number {
  if (raw == null || raw === "") return DEFAULT_PAGE_LIMIT;
  const parsed = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_PAGE_LIMIT;
  return Math.min(Math.floor(parsed), MAX_PAGE_LIMIT);
}

/**
 * Fold an over-fetched row set into the canonical `{ data, nextCursor }` shape.
 *
 * @remarks
 * Convention: callers fetch with `take: limit + 1` so an extra row
 * signals "next page exists". This helper slices to `limit` on the way
 * out and surfaces the last returned row's cursor field.
 *
 * Generic `K extends keyof T` keeps the cursor field type-checked —
 * a stringly-typed `"id"` would silently break when a column is renamed.
 *
 * @param rows - Raw rows fetched with `take: limit + 1`.
 * @param limit - Requested page size.
 * @param cursorField - Field to surface as `nextCursor` on the last row.
 * @returns Canonical list response shape.
 *
 * @example
 * const rows = await prisma.session.findMany({ take: limit + 1, ... });
 * return buildCursorResponse(rows, limit, "id");
 * // → { data: Session[], nextCursor: string | null }
 */
export function buildCursorResponse<T, K extends keyof T>(
  rows: T[],
  limit: number,
  cursorField: K,
): { data: T[]; nextCursor: T[K] | null } {
  const hasMore = rows.length > limit;
  const data = hasMore ? rows.slice(0, limit) : rows;
  const lastRow = data.at(-1);
  return {
    data,
    nextCursor: hasMore && lastRow ? lastRow[cursorField] : null,
  };
}
