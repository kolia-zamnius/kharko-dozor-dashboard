/**
 * Unit tests for `localizeZodError`.
 *
 * @remarks
 * `next-intl/server::getTranslations` reads locale from the active request
 * context, which doesn't exist in a unit test. Module-mocking the import
 * is the standard Vitest pattern — we hand it a translator that echoes
 * keys verbatim so the assertions focus on the shape (message concat,
 * path prefixing, issues array) rather than the copy itself (copy is
 * tested separately in `zod-error-map.test.ts`).
 */

import { describe, expect, it, vi } from "vitest";
import type { getTranslations } from "next-intl/server";
import { z } from "zod";

// The translator the real helper awaits — we intercept it here with an
// echo-style function. The cast mirrors the one in `translator.ts`
// helper: the next-intl `getTranslations` runtime shape is a superset
// of what our single-call-site consumer uses.
vi.mock("next-intl/server", () => ({
  getTranslations: vi.fn(async () => {
    const t = (key: string) => key;
    return t as unknown as Awaited<ReturnType<typeof getTranslations>>;
  }),
}));

// Re-import AFTER the mock is in place so the helper picks up the stub.
// Vitest hoists `vi.mock` above all imports automatically, so the order
// here is documentation — not a runtime requirement.
import { localizeZodError } from "./localize-zod-error";

describe("localizeZodError", () => {
  it("rebuilds each issue's message via the translator", async () => {
    // Mocked translator echoes keys verbatim, so asserting the message
    // contains `invalidFormat.email` proves (a) the translator was
    // invoked, and (b) the email-format issue routed to the right key
    // in `buildZodErrorMap`. Multi-issue coverage lives in the next
    // test.
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
    // `field.sub: message; other.path: message` shape.
    expect(localized.message).toMatch(/^email: /);
  });

  it("falls back to 'Invalid input' when there are no issues", async () => {
    // A ZodError with zero issues shouldn't occur from a real parse, but
    // the function handles it defensively — the empty `message.join("; ")`
    // becomes `""`, and the empty-string guard kicks in.
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
