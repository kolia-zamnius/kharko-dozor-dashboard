"use client";

import { useLocale, useTranslations } from "next-intl";
import { useMemo } from "react";

import type { Locale } from "@/i18n/config";
import { formatCount, formatDate, formatDateTime, formatDuration, formatRole, truncateId } from "@/lib/format";
import { formatRelative, formatRelativeFromSeconds } from "@/lib/format-relative";

type Role = "OWNER" | "ADMIN" | "VIEWER";

/**
 * Locale-aware formatters pre-bound to the active request.
 *
 * @remarks
 * Every client component that used to pull `formatDate`, `formatRole`,
 * etc. directly from `@/lib/format*` now calls this hook instead. The
 * returned object closes over `useLocale()` + the relevant scoped
 * translators, so call sites don't have to thread a locale or fetch a
 * translator manually — `useFormatters()` is the client-side equivalent
 * of passing `(locale, t)` on every invocation server-side.
 *
 * Stable across re-renders via `useMemo`. The scoped translators
 * (`useTranslations(...)`) keep their identity inside next-intl's
 * provider, so the memo effectively rebuilds only on locale change —
 * which is exactly when we WANT cached formatter instances inside
 * `formatDate` / `formatRelativeFromSeconds` to invalidate.
 *
 * `truncateId` is re-exported pass-through for import-symmetry — it
 * has no locale dependency, but exposing it through the same hook
 * means consumers don't have to import from two different modules to
 * format one table row.
 *
 * @see src/lib/format.ts — pure functions this hook wraps.
 * @see src/lib/format-relative.ts — relative-time staircase.
 */
export function useFormatters() {
  const locale = useLocale() as Locale;
  const tRoles = useTranslations("settings.orgs.roles");
  const tDuration = useTranslations("common.duration");
  const tRelative = useTranslations("common.relative");

  return useMemo(
    () => ({
      locale,
      formatDate: (date: string | Date) => formatDate(date, locale),
      formatDateTime: (input: string | Date | number, options: Intl.DateTimeFormatOptions) =>
        formatDateTime(input, options, locale),
      formatCount: (n: number) => formatCount(n, locale),
      formatRole: (role: Role) => formatRole(role, tRoles),
      formatDuration: (seconds: number) => formatDuration(seconds, tDuration),
      formatRelative: (iso: string) => formatRelative(iso, locale, tRelative),
      formatRelativeFromSeconds: (diffSec: number) => formatRelativeFromSeconds(diffSec, locale, tRelative),
      truncateId,
    }),
    [locale, tRoles, tDuration, tRelative],
  );
}
