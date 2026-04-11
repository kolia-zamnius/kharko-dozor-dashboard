/**
 * Unit smoke for `generateApiKey`.
 *
 * @remarks
 * Trivial body, but the format invariant (`dp_` prefix, 32-hex body) is
 * the contract `maskApiKey` depends on + the parser at
 * `POST /api/ingest::withPublicKey`. A regression in `randomBytes(16)`
 * or a fat-finger in the template string silently breaks every
 * downstream SDK. `fast-check` isn't needed here — `randomBytes` is
 * Node's CSPRNG, cryptographic quality is someone else's test budget.
 */

import { describe, expect, it } from "vitest";

import { maskApiKey } from "@/lib/mask-api-key";

import { generateApiKey } from "./generate-api-key";

describe("generateApiKey", () => {
  it("returns a dp_-prefixed 32-hex key", () => {
    const key = generateApiKey();
    expect(key).toMatch(/^dp_[a-f0-9]{32}$/);
  });

  it("produces unique keys across calls (birthday check, N=1000)", () => {
    // 32 hex chars = 128 bits of entropy — collisions at this scale are
    // negligible. A loop of 1k is a sanity check on "my RNG is actually
    // random" rather than an entropy assertion.
    const keys = new Set<string>();
    for (let i = 0; i < 1000; i++) keys.add(generateApiKey());
    expect(keys.size).toBe(1000);
  });

  it("round-trips through `maskApiKey` cleanly", () => {
    // Verifies the two halves of the brand-typed pair agree on shape —
    // a change to the prefix in one file that forgot the other would
    // surface here.
    const masked = maskApiKey(generateApiKey());
    expect(masked).toMatch(/^dp_.{4}•+.{4}$/);
  });
});
