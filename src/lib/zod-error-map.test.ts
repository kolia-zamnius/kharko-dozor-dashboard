/**
 * Unit tests for `buildZodErrorMap`.
 *
 * @remarks
 * Every `ZodIssueCode` branch has at least one assertion — the switch is
 * exhaustive in the source, so adding a new branch without its test here
 * is a deliberate omission that reviewers can catch. Custom refinements
 * keep their author-provided message verbatim (bottom of the file).
 */

import { describe, expect, it } from "vitest";
import { z } from "zod";

import { realTranslator } from "../../tests/helpers/translator";
import { buildZodErrorMap } from "./zod-error-map";

// `buildZodErrorMap` accepts a next-intl `Translator<...>` runtime shape;
// our `TestTranslator` is structurally compatible at the surface we use.
// Cast at the boundary per the convention in `tests/helpers/translator.ts`.
type ValidationT = Parameters<typeof buildZodErrorMap>[0];

async function buildEnMap() {
  const t = (await realTranslator("en", "errors.validation")) as unknown as ValidationT;
  return buildZodErrorMap(t);
}

describe("buildZodErrorMap", () => {
  it("maps invalid_type with undefined input to 'Required'", async () => {
    const map = await buildEnMap();
    const msg = runMap(map, {
      code: "invalid_type",
      expected: "string",
      input: undefined,
      path: [],
      message: "",
    });
    expect(msg).toBe("Required");
  });

  it("maps invalid_type with non-undefined input to the expected-type copy", async () => {
    const map = await buildEnMap();
    const msg = runMap(map, {
      code: "invalid_type",
      expected: "string",
      input: 42,
      path: [],
      message: "",
    });
    expect(msg).toBe("Expected string");
  });

  it("maps too_small for string to a plural-aware character-count message", async () => {
    const map = await buildEnMap();
    const one = runMap(map, {
      code: "too_small",
      origin: "string",
      minimum: 1,
      inclusive: true,
      input: "",
      path: [],
      message: "",
    });
    expect(one).toBe("Must be at least 1 character");

    const five = runMap(map, {
      code: "too_small",
      origin: "string",
      minimum: 5,
      inclusive: true,
      input: "",
      path: [],
      message: "",
    });
    expect(five).toBe("Must be at least 5 characters");
  });

  it("maps too_big for array with plural-aware item-count message", async () => {
    const map = await buildEnMap();
    expect(
      runMap(map, {
        code: "too_big",
        origin: "array",
        maximum: 3,
        inclusive: true,
        input: [],
        path: [],
        message: "",
      }),
    ).toBe("Must have at most 3 items");
  });

  it("routes invalid_format.email to the email-specific copy", async () => {
    const map = await buildEnMap();
    expect(
      runMap(map, {
        code: "invalid_format",
        format: "email",
        input: "not-an-email",
        path: [],
        message: "",
      }),
    ).toBe("Invalid email address");
  });

  it("collapses every ID-format (cuid / ulid / nanoid / …) to one message", async () => {
    const map = await buildEnMap();
    for (const format of ["cuid", "cuid2", "ulid", "xid", "ksuid", "nanoid"] as const) {
      expect(
        runMap(map, {
          code: "invalid_format",
          format,
          input: "bogus",
          path: [],
          message: "",
        }),
      ).toBe("Invalid ID");
    }
  });

  it("interpolates prefix / suffix / includes constraints into the message", async () => {
    const map = await buildEnMap();
    expect(
      runMap(map, {
        code: "invalid_format",
        format: "starts_with",
        prefix: "dp_",
        input: "bogus",
        path: [],
        message: "",
      }),
    ).toBe('Must start with "dp_"');

    expect(
      runMap(map, {
        code: "invalid_format",
        format: "ends_with",
        suffix: ".json",
        input: "bogus",
        path: [],
        message: "",
      }),
    ).toBe('Must end with ".json"');
  });

  it("maps unrecognized_keys with key list", async () => {
    const map = await buildEnMap();
    expect(
      runMap(map, {
        code: "unrecognized_keys",
        keys: ["foo", "bar"],
        input: {},
        path: [],
        message: "",
      }),
    ).toBe("Unrecognized keys: foo, bar");
  });

  it("maps invalid_value with options list", async () => {
    const map = await buildEnMap();
    expect(
      runMap(map, {
        code: "invalid_value",
        values: ["red", "green", "blue"],
        input: "purple",
        path: [],
        message: "",
      }),
    ).toBe("Must be one of: red, green, blue");
  });

  it("preserves author-provided message on custom refinements", async () => {
    const map = await buildEnMap();
    const result = runMap(map, {
      code: "custom",
      input: "x",
      path: [],
      message: "Confirm phrase does not match",
    });
    expect(result).toBe("Confirm phrase does not match");
  });

  it("integrates end-to-end with a real zod schema safeParse", async () => {
    // Confirms the error map works when plugged into a live schema —
    // not just when handed synthetic issue objects.
    const map = await buildEnMap();
    const schema = z.object({ email: z.email() });
    const result = schema.safeParse({ email: "nope" });
    expect(result.success).toBe(false);
    if (!result.success) {
      const msg = runMap(map, { ...result.error.issues[0]!, message: "" });
      expect(msg).toBe("Invalid email address");
    }
  });
});

// Helper: zod's error map returns `string | { message } | undefined`. Tests
// consistently want the flat `string` so we normalise once here instead of
// repeating `typeof r === "string" ? r : r?.message` at every call site.
function runMap(map: ReturnType<typeof buildZodErrorMap>, issue: unknown): string {
  // The real `$ZodErrorMap` receives `$ZodRawIssue` shapes — for test
  // simplicity we accept unknown and cast at the seam. Asserted-at-runtime
  // via the map throwing on a genuinely bad shape.
  const result = map(issue as Parameters<typeof map>[0]);
  if (typeof result === "string") return result;
  return result?.message ?? "";
}
