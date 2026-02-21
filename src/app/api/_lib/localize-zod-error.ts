import "server-only";

import { getTranslations } from "next-intl/server";
import type { ZodError, ZodIssue } from "zod";
import type { $ZodRawIssue } from "zod/v4/core";

import { buildZodErrorMap } from "@/lib/zod-error-map";

type LocalizedIssue = ZodIssue & { message: string };

type LocalizedZodError = {
  /** Full concat — `field.sub: message; other.path: message` — same format the old `withAuth` emitted. */
  readonly message: string;
  /** Original issues with their `message` field replaced by a localised string. */
  readonly issues: LocalizedIssue[];
};

/**
 * Localise a `ZodError` using the `errors.validation` namespace.
 *
 * @remarks
 * Called from the boundary HOFs (`withAuth`, `withPublicKey`) when a
 * route handler throws a `ZodError`. We rebuild each issue's `message`
 * through the shared `buildZodErrorMap` so recipients see localised
 * copy without mutating the global `z.config` (which would race across
 * concurrent requests with different locales).
 *
 * `getTranslations("errors.validation")` reads locale from the active
 * request context — populated by `next-intl`'s middleware integration,
 * so a handler on `/uk/...` resolves to Ukrainian messages without any
 * explicit locale plumbing in this helper.
 *
 * Concatenated `message` keeps the `field.sub: message; other: message`
 * shape the dashboard has relied on since Block 1 — clients read
 * `body.error` as a single human string, `body.issues` when they want
 * structured per-field routing.
 *
 * @see src/lib/zod-error-map.ts — shared `$ZodErrorMap` builder.
 * @see src/app/api/_lib/with-auth.ts — primary consumer.
 * @see src/app/api/_lib/with-public-key.ts — twin SDK-facing consumer.
 */
export async function localizeZodError(err: ZodError): Promise<LocalizedZodError> {
  const tValidation = await getTranslations("errors.validation");
  const errorMap = buildZodErrorMap(tValidation);

  const issues: LocalizedIssue[] = err.issues.map((issue) => {
    // `$ZodErrorMap` returns `{ message } | string | undefined | null`.
    // Fall back to the original `issue.message` for `undefined` / `null`
    // so custom issues with bespoke copy keep their author-provided
    // wording (see the `custom` branch inside `buildZodErrorMap`).
    //
    // Finalised `$ZodIssue`s are structurally compatible with `$ZodRawIssue`
    // (the raw variant just marks `message`/`path` optional and widens
    // extra fields to `unknown`); the cast bridges the type gap without
    // copying the issue shape.
    const result = errorMap(issue as $ZodRawIssue);
    const message = typeof result === "string" ? result : (result?.message ?? issue.message);
    return { ...issue, message };
  });

  const message = issues.map((i) => (i.path.length ? `${i.path.join(".")}: ` : "") + i.message).join("; ");

  return { message: message || "Invalid input", issues };
}
