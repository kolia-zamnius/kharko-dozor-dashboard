import type { getTranslations } from "next-intl/server";
import type { $ZodErrorMap } from "zod/v4/core";

import { assertNever } from "@/lib/assert-never";

type ValidationTranslator = Awaited<ReturnType<typeof getTranslations<"errors.validation">>>;

/**
 * Locale-aware Zod 4 error map. Installed on the client via `z.config({ customError })`
 * in {@link src/app/_providers/i18n-bridge.tsx} and rebuilt per-request server-side
 * inside `withAuth` / `withPublicKey` (mutating global `z.config` would race across
 * concurrent requests with different locales).
 *
 * `invalid_type` + `input === undefined` → "Required" because that's the most common
 * react-hook-form empty-field case and "Expected string" reads odd in a form context.
 * `custom` issues keep their own `message` so `.refine({ message })` copy survives.
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
          // `$ZodIssue` only carries the base `$ZodIssueInvalidStringFormat`; the
          // per-format subtypes (`starts_with` etc.) live on a separate union, so
          // `format`-discrimination can't narrow. Read extra fields off the raw
          // `Record<string, unknown>` slot via `typeof` guards.
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
        return issue.message ?? t("custom");

      default:
        return assertNever(issue);
    }
  };
}
