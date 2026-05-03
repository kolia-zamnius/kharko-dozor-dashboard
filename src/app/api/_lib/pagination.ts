import "server-only";

import { DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT } from "./constants";

/**
 * Defence-in-depth — zod schemas already cap `limit` at 100, but routes that
 * bypass the schema (direct `searchParams.get`) still need clamping +
 * missing/invalid normalisation. Accepts both string and pre-parsed number
 * because both call sites exist.
 */
export function parseLimitParam(raw: string | number | null | undefined): number {
  if (raw == null || raw === "") return DEFAULT_PAGE_LIMIT;
  const parsed = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_PAGE_LIMIT;
  return Math.min(Math.floor(parsed), MAX_PAGE_LIMIT);
}

/**
 * Convention — callers fetch with `take: limit + 1`; the extra row signals
 * "next page exists". `K extends keyof T` keeps the cursor field type-checked
 * so a column rename surfaces as a compile error, not a stringly-typed bug.
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
