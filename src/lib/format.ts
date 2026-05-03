import type { getTranslations } from "next-intl/server";

import type { Locale } from "@/i18n/config";

/**
 * Application-locale → CLDR-tag mapping. Explicit so adding a new app locale can't
 * silently fall through to JS default `en-US` (would flip dates to MM/DD/YYYY and
 * break the European visual style). `en` → `en-GB` to preserve DD/MM/YYYY ordering.
 */
export const CLDR_LOCALES: Record<Locale, string> = {
  en: "en-GB",
  uk: "uk-UA",
  de: "de-DE",
  es: "es-ES",
  pt: "pt-PT",
  it: "it-IT",
};

type RolesTranslator = Awaited<ReturnType<typeof getTranslations<"settings.orgs.roles">>>;
type DurationTranslator = Awaited<ReturnType<typeof getTranslations<"common.duration">>>;
type Role = "OWNER" | "ADMIN" | "VIEWER";

export function formatDate(date: string | Date, locale: Locale): string {
  const formatter = new Intl.DateTimeFormat(CLDR_LOCALES[locale], {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  return formatter.format(typeof date === "string" ? new Date(date) : date);
}

/**
 * Throws `RangeError` with the offending input on invalid Date — `Intl`'s native
 * "Invalid time value" buries the actual culprit in the stack trace.
 */
export function formatDateTime(
  input: string | Date | number,
  options: Intl.DateTimeFormatOptions,
  locale: Locale,
): string {
  const formatter = new Intl.DateTimeFormat(CLDR_LOCALES[locale], options);
  const date = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(date.getTime())) {
    throw new RangeError(`formatDateTime: invalid input ${JSON.stringify(input)}`);
  }
  return formatter.format(date);
}

export function formatCount(n: number, locale: Locale): string {
  const formatter = new Intl.NumberFormat(CLDR_LOCALES[locale]);
  return formatter.format(n);
}

/** Looks up `settings.orgs.roles.<key>.label` — single source for role display copy across chips, dropdowns, toasts, emails. */
export function formatRole(role: Role, t: RolesTranslator): string {
  const key = role.toLowerCase() as Lowercase<Role>;
  return t(`${key}.label`);
}

/** Two significant components max ("2h 15m", never "2h 15m 30s"). The replay player has its own frame-accurate seek-bar formatter. */
export function formatDuration(seconds: number, t: DurationTranslator): string {
  if (seconds < 60) return t("seconds", { count: seconds });
  const totalMinutes = Math.floor(seconds / 60);
  if (totalMinutes < 60) {
    const s = seconds % 60;
    return s > 0 ? t("minutesSeconds", { minutes: totalMinutes, seconds: s }) : t("minutes", { count: totalMinutes });
  }
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return m > 0 ? t("hoursMinutes", { hours: h, minutes: m }) : t("hours", { count: h });
}

export function truncateId(id: string, length = 8): string {
  return id.length > length ? `${id.slice(0, length)}...` : id;
}
