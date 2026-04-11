/**
 * Unit tests for `maskApiKey`.
 *
 * @remarks
 * The masking rules are simple but security-relevant — a bug that widens
 * the visible slice leaks key material to logs + client payloads.
 * Property-based test via `fast-check` covers the "no more than 8 raw
 * characters ever visible" invariant across random input lengths.
 */

import { describe, expect, it } from "vitest";
import fc from "fast-check";

import { maskApiKey, type ApiKeyPlaintext } from "./mask-api-key";

function plaintext(raw: string): ApiKeyPlaintext {
  return raw as ApiKeyPlaintext;
}

describe("maskApiKey", () => {
  it("keeps the dp_ prefix plus first 4 and last 4 of the body", () => {
    const raw = plaintext("dp_abc123def456ghi789jkl012mno345pqr6");
    expect(maskApiKey(raw)).toBe("dp_abc1••••••••••••••••••••••••••pqr6");
  });

  it("fills the middle with at least 4 bullets for any dp_ key with body > 8 chars", () => {
    const raw = plaintext("dp_abcdefghijkl"); // body length 12
    const masked = maskApiKey(raw);
    expect(masked.startsWith("dp_abcd")).toBe(true);
    expect(masked.endsWith("ijkl")).toBe(true);
    // length(body) - 8 = 4 bullets (the min enforced by the helper).
    expect(masked).toBe("dp_abcd••••ijkl");
  });

  it("replaces the entire body with bullets when body ≤ 8 chars", () => {
    expect(maskApiKey(plaintext("dp_short"))).toBe("dp_•••••");
    expect(maskApiKey(plaintext("dp_"))).toBe("dp_");
  });

  it("returns a generic masked sentinel for anything not starting with dp_", () => {
    expect(maskApiKey(plaintext("zz_malformed_key"))).toBe("••••••");
    expect(maskApiKey(plaintext(""))).toBe("••••••");
  });

  // Invariant: every well-formed key masks to a string that exposes at
  // most 4 + 4 = 8 characters of raw key material. `fast-check` walks a
  // generous space of lengths + hex character sets to catch an off-by-one
  // in `head`/`tail` slicing.
  it("never exposes more than 8 raw chars of a dp_-prefixed key", () => {
    // fast-check v4 dropped `hexaString` in favour of the unit-based
    // `string({ unit })` constructor. Hex alphabet matches the real
    // `dp_<32hex>` production format.
    const hexChar = fc.constantFrom(..."0123456789abcdef".split(""));
    fc.assert(
      fc.property(fc.string({ unit: hexChar, minLength: 9, maxLength: 64 }), (body) => {
        const masked = maskApiKey(plaintext(`dp_${body}`));
        const nonBullet = masked.replace(/^dp_/, "").replace(/•/g, "");
        return nonBullet.length <= 8;
      }),
    );
  });
});
