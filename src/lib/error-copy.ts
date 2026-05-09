import type { useTranslations } from "next-intl";

import { isApiError } from "@/api-client/_lib/error";
import { assertNever } from "@/lib/assert-never";

/**
 * Centralised `ApiErrorKind` → product copy used by every `error.tsx` boundary —
 * a new kind walks the compiler through every consumer via `assertNever`. `context`
 * is the already-localised noun ("User", "Replays") owned by the feature, so the
 * errors namespace doesn't re-translate it. `t` is injected because this module
 * has no `"use client"` and must not tie to the hook lifecycle.
 *
 * The `auth` branch is defensive — the global `QueryCache.onError` in
 * {@link src/lib/query-client.ts} hard-redirects to `/sign-in`, but the copy fills
 * the slim window before that lands.
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
