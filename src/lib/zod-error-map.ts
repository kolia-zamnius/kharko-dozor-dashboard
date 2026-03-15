import type { getTranslations } from "next-intl/server";
import type { $ZodErrorMap } from "zod/v4/core";

import { assertNever } from "@/lib/assert-never";

/**
 * Scoped translator for the `errors.validation` namespace. Same shape on
 * client (`useTranslations`) and server (`getTranslations`), so the same
 * error map consumes either side — no adapter needed.
 */
type ValidationTranslator = Awaited<ReturnType<typeof getTranslations<"errors.validation">>>;

/**
 * Build a locale-aware `$ZodErrorMap` for Zod 4.
 *
 * @remarks
 * Called in two places:
 *
 *   1. Client — installed once via `z.config({ customError })` in
 *      `src/app/_providers/i18n-bridge.tsx`, so every `schema.parse()` call anywhere
 *      on the client (notably `react-hook-form` + `zodResolver`)
 *      produces localised messages without the form wiring an error map
 *      per-field.
 *   2. Server — rebuilt per-request in the `ZodError` catch branch of
 *      `withAuth` / `withPublicKey`, so validation failures returned
 *      across the HTTP boundary match the recipient's locale without
 *      mutating global `z.config` from a concurrent handler.
 *
 * The switch is exhaustive — `assertNever` on the default branch means
 * an upstream Zod issue-code addition is a compile error in this file,
 * not a silent "Invalid input" fallback in production.
 *
 * **Required vs invalid_type:** forms with `zodResolver` typically hit
 * `invalid_type` with `input === undefined` when a required field is
 * empty. "Required" reads better than "Expected string" in a form
 * context, so we special-case it — callers that want the richer message
 * can set `input` explicitly in their schema.
 *
 * **Custom issues** keep their own `message` rather than being replaced,
 * so `.refine((v) => …, { message: "Too long" })` still shows the
 * author-provided copy.
 *
 * @see src/app/_providers/i18n-bridge.tsx — client installation site.
 * @see src/app/api/_lib/with-auth.ts — server catch-branch consumer.
 * @see src/app/api/_lib/with-public-key.ts — twin SDK-facing consumer.
 */
export function buildZodErrorMap(t: ValidationTranslator): $ZodErrorMap {
  return (issue) => {
    switch (issue.code) {
      case "invalid_type":
        if (issue.input === undefined) return t("required");
        return t("invalidType", { expected: issue.expected });

      case "too_small":
        switch (issue.origin) {
          case "string":
            return t("tooSmall.string", { minimum: Number(issue.minimum) });
          case "array":
          case "set":
            return t("tooSmall.array", { minimum: Number(issue.minimum) });
          case "number":
          case "int":
          case "bigint":
          case "date":
            return t("tooSmall.number", { minimum: Number(issue.minimum) });
          case "file":
            return t("tooSmall.file");
          default:
            return t("tooSmall.generic");
        }

      case "too_big":
        switch (issue.origin) {
          case "string":
            return t("tooBig.string", { maximum: Number(issue.maximum) });
          case "array":
          case "set":
            return t("tooBig.array", { maximum: Number(issue.maximum) });
          case "number":
          case "int":
          case "bigint":
          case "date":
            return t("tooBig.number", { maximum: Number(issue.maximum) });
          case "file":
            return t("tooBig.file");
          default:
            return t("tooBig.generic");
        }

      case "invalid_format":
        // `$ZodStringFormats` is a union of ~20 literal format names plus
        // `(string & {})` for author-defined formats. We group the ones
        // that share a user-facing message (all ID-style formats resolve
        // to the same "Invalid ID" copy, etc.) and fall through to
        // `generic` for the long tail of obscure refinements.
        switch (issue.format) {
          case "email":
            return t("invalidFormat.email");
          case "url":
            return t("invalidFormat.url");
          case "uuid":
          case "guid":
            return t("invalidFormat.uuid");
          case "cuid":
          case "cuid2":
          case "ulid":
          case "xid":
          case "ksuid":
          case "nanoid":
            return t("invalidFormat.id");
          case "datetime":
          case "date":
          case "time":
          case "duration":
            return t("invalidFormat.datetime");
          case "ipv4":
          case "ipv6":
          case "cidrv4":
          case "cidrv6":
            return t("invalidFormat.ip");
          case "regex":
            return t("invalidFormat.regex");
          // Zod's `$ZodIssue` union only carries the base
          // `$ZodIssueInvalidStringFormat`; the per-format subtypes
          // (`$ZodIssueStringStartsWith`, etc.) live on a separate
          // `$ZodStringFormatIssues` union that isn't part of
          // `$ZodIssue`, so `format`-discrimination can't narrow the
          // base issue to the specific shape. The raw-issue
          // `Record<string, unknown>` slot still exposes the extra
          // field — read it via a `typeof` guard so we stay inside the
          // type system without casting.
          case "starts_with": {
            const prefix = typeof issue.prefix === "string" ? issue.prefix : "";
            return t("invalidFormat.startsWith", { prefix });
          }
          case "ends_with": {
            const suffix = typeof issue.suffix === "string" ? issue.suffix : "";
            return t("invalidFormat.endsWith", { suffix });
          }
          case "includes": {
            const includes = typeof issue.includes === "string" ? issue.includes : "";
            return t("invalidFormat.includes", { includes });
          }
          case "emoji":
          case "base64":
          case "base64url":
          case "e164":
          case "jwt":
          case "json_string":
          case "lowercase":
          case "uppercase":
          default:
            return t("invalidFormat.generic");
        }

      case "not_multiple_of":
        return t("notMultipleOf", { divisor: Number(issue.divisor) });

      case "unrecognized_keys":
        return t("unrecognizedKeys", { count: issue.keys.length, keys: issue.keys.join(", ") });

      case "invalid_union":
        return t("invalidUnion");

      case "invalid_key":
        return t("invalidKey");

      case "invalid_element":
        return t("invalidElement");

      case "invalid_value":
        return t("invalidValue", { options: issue.values.map((v) => String(v)).join(", ") });

      case "custom":
        // Custom issues carry their own message (via `.refine({ message })`
        // or `z.custom`). Preserve author-provided copy verbatim — the
        // error map is only a fallback when nothing more specific exists.
        return issue.message ?? t("custom");

      default:
        return assertNever(issue);
    }
  };
}
