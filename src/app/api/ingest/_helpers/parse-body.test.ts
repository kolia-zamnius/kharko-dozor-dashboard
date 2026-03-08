/**
 * Property-based tests for `ingestSchema`.
 *
 * @remarks
 * Ingest is the SDK wire contract — every self-hoster depends on the
 * schema being permissive enough to accept real SDK payloads and strict
 * enough to reject malformed ones. Hand-written unit tests cover the
 * happy path in `tests/integration/ingest.test.ts`; this suite adds
 * `fast-check` properties that walk the input space systematically:
 *
 *   - Valid envelopes of varying shape → always parse.
 *   - Invariants enforced at the boundary (UUID format, event cap,
 *     enum reason) → rejections fire deterministically regardless of
 *     neighbouring valid fields.
 *
 * Pure parser — no DB, no prisma, no mocks. Belongs in the `unit`
 * project even though the source file carries `server-only` (the
 * test-env alias neutralises that guard).
 */

import { describe, expect, it } from "vitest";
import fc from "fast-check";

import { ingestSchema } from "./parse-body";

// Minimal valid base used by several properties — the common skeleton
// callers mutate with `{ ...BASE, events: [...] }` etc.
const BASE_SESSION_ID = "550e8400-e29b-41d4-a716-446655440000";

const validEventArb = fc.record({
  type: fc.integer({ min: 0, max: 6 }),
  data: fc.object(),
  timestamp: fc.integer({ min: 1, max: 2_000_000_000_000 }),
  sliceIndex: fc.option(fc.nat(100), { nil: undefined }),
});

const validSliceMarkerArb = fc.record({
  index: fc.nat(100),
  reason: fc.constantFrom("init", "idle", "navigation"),
  startedAt: fc.integer({ min: 1, max: 2_000_000_000_000 }),
  url: fc.webUrl(),
  pathname: fc.string({ minLength: 1, maxLength: 100 }),
  viewportWidth: fc.option(fc.nat(10_000), { nil: undefined }),
  viewportHeight: fc.option(fc.nat(10_000), { nil: undefined }),
});

describe("ingestSchema", () => {
  it("accepts any envelope with up to 500 valid events + valid slice markers", () => {
    fc.assert(
      fc.property(
        fc.array(validEventArb, { maxLength: 500 }),
        fc.array(validSliceMarkerArb, { maxLength: 50 }),
        (events, sliceMarkers) => {
          const result = ingestSchema.safeParse({
            sessionId: BASE_SESSION_ID,
            events,
            sliceMarkers,
          });
          return result.success;
        },
      ),
    );
  });

  it("rejects an envelope with more than 500 events", () => {
    fc.assert(
      fc.property(fc.integer({ min: 501, max: 1_000 }), (count) => {
        const events = Array.from({ length: count }, () => ({
          type: 2,
          data: {},
          timestamp: Date.now(),
        }));
        const result = ingestSchema.safeParse({ sessionId: BASE_SESSION_ID, events });
        return !result.success;
      }),
    );
  });

  it("rejects a non-UUID sessionId", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 50 }).filter((s) => !/^[0-9a-f-]{36}$/i.test(s)),
        (bogus) => {
          const result = ingestSchema.safeParse({ sessionId: bogus, events: [] });
          return !result.success;
        },
      ),
    );
  });

  it("rejects slice markers with an unknown `reason`", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 20 }).filter((s) => !["init", "idle", "navigation"].includes(s)),
        (reason) => {
          const result = ingestSchema.safeParse({
            sessionId: BASE_SESSION_ID,
            events: [],
            sliceMarkers: [
              {
                index: 0,
                reason,
                startedAt: 1,
                url: "https://example.com",
                pathname: "/",
              },
            ],
          });
          return !result.success;
        },
      ),
    );
  });

  it("accepts a valid userIdentity with arbitrary traits", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 255 }),
        fc.dictionary(fc.string({ minLength: 1, maxLength: 20 }), fc.anything()),
        (userId, traits) => {
          const result = ingestSchema.safeParse({
            sessionId: BASE_SESSION_ID,
            events: [],
            metadata: {
              url: "https://example.com",
              referrer: "",
              userAgent: "test",
              screenWidth: 1920,
              screenHeight: 1080,
              language: "en",
              userIdentity: { userId, traits },
            },
          });
          return result.success;
        },
      ),
    );
  });

  it("rejects empty userId inside userIdentity", () => {
    const result = ingestSchema.safeParse({
      sessionId: BASE_SESSION_ID,
      events: [],
      metadata: {
        url: "https://example.com",
        referrer: "",
        userAgent: "test",
        screenWidth: 1920,
        screenHeight: 1080,
        language: "en",
        userIdentity: { userId: "" },
      },
    });
    expect(result.success).toBe(false);
  });

  it("tolerates the legacy `pageViews` field (unused, but must not reject)", () => {
    // Old SDK builds still emit `pageViews`; schema keeps it permissive so
    // a pinned customer doesn't brick on an extra-key strict reject.
    const result = ingestSchema.safeParse({
      sessionId: BASE_SESSION_ID,
      events: [],
      pageViews: [{ url: "legacy" }],
    });
    expect(result.success).toBe(true);
  });
});
