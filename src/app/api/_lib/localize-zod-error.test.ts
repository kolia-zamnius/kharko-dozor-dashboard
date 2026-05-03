/**
 * Echo translator + module mock — assertions focus on shape (concat, path
 * prefix, issues array). Copy correctness lives in `zod-error-map.test.ts`.
 */

import { describe, expect, it, vi } from "vitest";
import type { getTranslations } from "next-intl/server";
import { z } from "zod";

vi.mock("next-intl/server", () => ({
  getTranslations: vi.fn(async () => {
    const t = (key: string) => key;
    return t as unknown as Awaited<ReturnType<typeof getTranslations>>;
  }),
}));

import { localizeZodError } from "./localize-zod-error";

describe("localizeZodError", () => {
  it("rebuilds each issue's message via the translator", async () => {
    // Echo translator returns keys verbatim — `invalidFormat.email` proves
    // the translator was invoked AND the email issue routed to the right key.
    const schema = z.object({ email: z.email() });
    const parsed = schema.safeParse({ email: "bogus" });
    if (parsed.success) throw new Error("schema should have failed");

    const localized = await localizeZodError(parsed.error);
    expect(localized.issues).toHaveLength(1);
    expect(localized.issues[0]?.message).toMatch(/invalidFormat\.email/);
  });

  it("concatenates issues into a single `message` string with path prefixes", async () => {
    const schema = z.object({ email: z.email() });
    const parsed = schema.safeParse({ email: "bogus" });
    if (parsed.success) throw new Error("schema should have failed");

    const localized = await localizeZodError(parsed.error);
    expect(localized.message).toMatch(/^email: /);
  });

  it("falls back to 'Invalid input' when there are no issues", async () => {
    // Defensive — empty `join("; ")` is `""`, the guard returns the fallback.
    const empty = new z.ZodError([]);
    const localized = await localizeZodError(empty);
    expect(localized.message).toBe("Invalid input");
    expect(localized.issues).toEqual([]);
  });

  it("preserves custom-issue messages verbatim (author-provided copy wins)", async () => {
    const schema = z.string().refine((v) => v.length > 3, {
      message: "String must be longer than 3 chars",
    });
    const parsed = schema.safeParse("ab");
    if (parsed.success) throw new Error("schema should have failed");

    const localized = await localizeZodError(parsed.error);
    expect(localized.issues[0]?.message).toBe("String must be longer than 3 chars");
  });
});
