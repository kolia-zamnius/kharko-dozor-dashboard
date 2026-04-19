import type { useTranslations } from "next-intl";

import { isApiError } from "@/api-client/error";
import { assertNever } from "@/lib/assert-never";

/**
 * Product-voice copy for a caught error — chosen by `ApiErrorKind`
 * where available, with a generic fallback for non-API errors.
 *
 * @remarks
 * Route-level `error.tsx` boundaries all want the same branching
 * logic: differentiate 404 from 403 from 5xx, surface a useful
 * sentence, keep a retry affordance. Duplicating a 7-arm `switch`
 * across four `error.tsx` files is exactly the sort of drift bait
 * senior-audited out. Centralizing here means a new `ApiErrorKind`
 * variant walks the compiler through every consumer via
 * {@link assertNever}.
 *
 * `context` is the **already-localised** noun the boundary is
 * rendering ("User", "Users list", "Replays") — interpolated into a
 * few branches so "not found" reads as "User not found" instead of
 * the generic fallback. Caller resolves the copy via its own
 * `useTranslations("<feature>")` call and hands the string in; we
 * don't re-translate here because the noun is owned by the feature,
 * not by the errors namespace.
 *
 * `t` is a scoped translator — `useTranslations("errors")` — passed
 * in rather than looked up inside because this module has no
 * `"use client"` and must not tie to the hook lifecycle.
 *
 * `auth` intentionally has its own branch even though
 * `lib/query-client.ts` globally intercepts auth-kind errors and
 * redirects to `/sign-in` — the copy exists as a defensive fallback
 * for the slim window between the error firing and the redirect
 * committing.
 */
export type ErrorCopy = {
  title: string;
  description: string;
};

type ErrorsTranslator = ReturnType<typeof useTranslations<"errors">>;

export function getErrorCopy(error: unknown, context: string, t: ErrorsTranslator): ErrorCopy {
  if (!isApiError(error)) {
    return {
      title: t("generic.unknown"),
      description: t("generic.unknownDescription"),
    };
  }

  switch (error.kind) {
    case "not-found":
      return {
        title: t("apiKinds.notFoundTitle", { context }),
        description: t("apiKinds.notFoundDescription"),
      };
    case "permission":
      return {
        title: t("apiKinds.permissionTitle"),
        description: t("apiKinds.permissionDescription"),
      };
    case "auth":
      return {
        title: t("apiKinds.authTitle"),
        description: t("apiKinds.authDescription"),
      };
    case "rate-limit":
      return {
        title: t("apiKinds.rateLimitTitle"),
        description: t("apiKinds.rateLimitDescription"),
      };
    case "validation":
      return {
        title: t("apiKinds.validationTitle"),
        description: error.message || t("apiKinds.validationDescriptionFallback"),
      };
    case "conflict":
      return {
        title: t("apiKinds.conflictTitle"),
        description: t("apiKinds.conflictDescription"),
      };
    case "server":
      return {
        title: t("apiKinds.serverTitle"),
        description: t("apiKinds.serverDescription", { context: context.toLowerCase() }),
      };
    case "network":
      return {
        title: t("apiKinds.networkTitle"),
        description: t("apiKinds.networkDescription"),
      };
    default:
      return assertNever(error.kind);
  }
}
