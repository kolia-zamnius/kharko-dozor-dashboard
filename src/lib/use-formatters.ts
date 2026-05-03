"use client";

import { useLocale, useTranslations } from "next-intl";
import { useMemo } from "react";

import type { Locale } from "@/i18n/config";
import { formatCount, formatDate, formatDateTime, formatDuration, formatRole, truncateId } from "@/lib/format";
import { formatRelative, formatRelativeFromSeconds } from "@/lib/format-relative";

type Role = "OWNER" | "ADMIN" | "VIEWER";

/**
 * Locale-aware formatters pre-bound to the active request — client equivalent of
 * threading `(locale, t)` into every server-side format call. Memoized on locale +
 * scoped translator identities; rebuilds only on locale change, which is exactly
 * when cached `Intl.*` formatters in {@link src/lib/format.ts} should invalidate.
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
