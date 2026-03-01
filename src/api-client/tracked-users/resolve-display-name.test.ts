/**
 * Unit tests for `resolveDisplayName`.
 *
 * @remarks
 * Walks the full 4-level priority chain plus the edge cases:
 * whitespace-only values (skipped), null traits (skipped), non-string
 * trait values (coerced via `String(x)`). Each test documents the
 * expected winner so a future reader can tell *why* a scenario resolves
 * to a particular step.
 */

import { describe, expect, it } from "vitest";

import { resolveDisplayName } from "./resolve-display-name";

describe("resolveDisplayName", () => {
  it("1. customName wins when present", () => {
    const out = resolveDisplayName({
      externalId: "user_123",
      traits: { name: "Trait Name" },
      customName: "Custom",
      displayNameTraitKey: "name",
      projectDefaultTraitKey: "name",
    });
    expect(out).toBe("Custom");
  });

  it("1.a customName trims surrounding whitespace and wins on non-empty result", () => {
    const out = resolveDisplayName({
      externalId: "user_123",
      traits: null,
      customName: "  Spaced  ",
      displayNameTraitKey: null,
      projectDefaultTraitKey: null,
    });
    expect(out).toBe("Spaced");
  });

  it("1.b empty-after-trim customName falls through", () => {
    const out = resolveDisplayName({
      externalId: "user_123",
      traits: { email: "a@b.com" },
      customName: "   ",
      displayNameTraitKey: "email",
      projectDefaultTraitKey: null,
    });
    expect(out).toBe("a@b.com");
  });

  it("2. user displayNameTraitKey wins when customName absent", () => {
    const out = resolveDisplayName({
      externalId: "user_123",
      traits: { email: "a@b.com", name: "Alice" },
      customName: null,
      displayNameTraitKey: "name",
      projectDefaultTraitKey: "email",
    });
    expect(out).toBe("Alice");
  });

  it("3. projectDefaultTraitKey wins when user key absent or missing in traits", () => {
    const out = resolveDisplayName({
      externalId: "user_123",
      traits: { email: "a@b.com" },
      customName: null,
      displayNameTraitKey: "name", // "name" isn't in traits
      projectDefaultTraitKey: "email",
    });
    expect(out).toBe("a@b.com");
  });

  it("4. externalId as final fallback", () => {
    const out = resolveDisplayName({
      externalId: "user_123",
      traits: null,
      customName: null,
      displayNameTraitKey: null,
      projectDefaultTraitKey: null,
    });
    expect(out).toBe("user_123");
  });

  it("coerces non-string trait values via String(…)", () => {
    const out = resolveDisplayName({
      externalId: "user_123",
      traits: { plan: 42 },
      customName: null,
      displayNameTraitKey: "plan",
      projectDefaultTraitKey: null,
    });
    expect(out).toBe("42");
  });

  it("treats null/undefined trait values as missing", () => {
    const out = resolveDisplayName({
      externalId: "user_123",
      traits: { name: null, email: "a@b.com" },
      customName: null,
      displayNameTraitKey: "name",
      projectDefaultTraitKey: "email",
    });
    expect(out).toBe("a@b.com");
  });

  it("treats whitespace-only trait values as missing (trimmed then skipped)", () => {
    const out = resolveDisplayName({
      externalId: "user_123",
      traits: { name: "   ", email: "a@b.com" },
      customName: null,
      displayNameTraitKey: "name",
      projectDefaultTraitKey: "email",
    });
    expect(out).toBe("a@b.com");
  });

  it("handles a missing traits object (null) without error", () => {
    const out = resolveDisplayName({
      externalId: "fallback",
      traits: null,
      customName: null,
      displayNameTraitKey: "name",
      projectDefaultTraitKey: "email",
    });
    expect(out).toBe("fallback");
  });
});
