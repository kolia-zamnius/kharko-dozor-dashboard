/**
 * Unit smoke test — proves the Vitest + TS-paths pipeline works end-to-end
 * for colocated `*.test.ts` files without DB involvement. The `assertNever`
 * function itself is intentionally trivial; the point is that a single run
 * of `npm run test:unit` passes with a green dot after Wave 1.
 */

import { describe, expect, it } from "vitest";

import { assertNever } from "./assert-never";

describe("assertNever", () => {
  it("throws at runtime when called with a non-never value (type-asserted)", () => {
    // Force a call through an `unknown` → `never` cast to exercise the
    // runtime branch. In real code, a type-safe caller would get a compile
    // error long before this throw matters.
    const rogue = "unexpected" as unknown as never;
    expect(() => assertNever(rogue)).toThrow(/Exhaustiveness check failed/);
  });
});
