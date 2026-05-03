import "server-only";

import { getTranslations } from "next-intl/server";
import type { ZodError, ZodIssue } from "zod";
import type { $ZodRawIssue } from "zod/v4/core";

import { buildZodErrorMap } from "@/lib/zod-error-map";

type LocalizedIssue = ZodIssue & { message: string };

type LocalizedZodError = {
  /** `field.sub: message; other.path: message` — single human string for `body.error`. */
  readonly message: string;
  readonly issues: LocalizedIssue[];
};

/**
 * Per-request localisation — never mutates global `z.config`, which would race
 * across concurrent requests with different locales. `getTranslations` reads
 * locale from the active request context, so `/uk/...` handlers resolve UK
 * messages without explicit plumbing.
 */
export async function localizeZodError(err: ZodError): Promise<LocalizedZodError> {
  const tValidation = await getTranslations("errors.validation");
  const errorMap = buildZodErrorMap(tValidation);

  const issues: LocalizedIssue[] = err.issues.map((issue) => {
    // Fall back to the original message on undefined/null so custom-issue
    // bespoke copy survives (see `custom` branch in `buildZodErrorMap`).
    // Cast — finalised `$ZodIssue` is structurally compatible with `$ZodRawIssue`.
    const result = errorMap(issue as $ZodRawIssue);
    const message = typeof result === "string" ? result : (result?.message ?? issue.message);
    return { ...issue, message };
  });

  const message = issues.map((i) => (i.path.length ? `${i.path.join(".")}: ` : "") + i.message).join("; ");

  return { message: message || "Invalid input", issues };
}
