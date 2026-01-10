import type { getTranslations } from "next-intl/server";

import type { Locale } from "@/i18n/config";

/**
 * Application-locale → CLDR-tag mapping.
 *
 * @remarks
 * Our `Locale` union is a short slug (e.g. `"en"`), but every
 * `Intl.*Format` constructor expects a full CLDR tag (`"en-GB"`,
 * `"uk-UA"`, …). Keeping the mapping explicit here makes sure that
 * adding a new application locale can't silently fall through to the
 * JS default (`en-US`, which would switch date format to MM/DD/YYYY
 * and break the European visual style the dashboard has shipped
 * since day one).
 *
 * `en` → `en-GB` specifically to preserve DD/MM/YYYY date ordering
 * (the legacy `uk-UA` default rendered DD.MM.YYYY with dot separators;
 * slashes are the standard EN variant).
 */
export const CLDR_LOCALES: Record<Locale, string> = {
  en: "en-GB",
  uk: "uk-UA",
  de: "de-DE",
  es: "es-ES",
  pt: "pt-PT",
  it: "it-IT",
};

/**
 * Scoped translator for `settings.orgs.roles` — only the role labels
 * are needed here, so the type is narrowed to that namespace. Matches
 * on both client (`useTranslations("settings.orgs.roles")`) and server
 * (`getTranslations({ locale, namespace: "settings.orgs.roles" })`).
 */
type RolesTranslator = Awaited<ReturnType<typeof getTranslations<"settings.orgs.roles">>>;

/**
 * Scoped translator for `common.duration` — the small set of ICU
 * pluralised unit templates that `formatDuration` composes.
 */
type DurationTranslator = Awaited<ReturnType<typeof getTranslations<"common.duration">>>;

/**
 * Role enum as it appears on the wire (Prisma enum literal). We use the
 * literal union rather than `string` so `formatRole` can't be called
 * with an unknown role and dead-fall through to an empty key lookup.
 */
type Role = "OWNER" | "ADMIN" | "VIEWER";

/**
 * Format an ISO date or `Date` instance as a short date string.
 *
 * @remarks
 * `Intl.DateTimeFormat` instances are expensive to construct (they walk
 * the ICU locale data on first call), but `formatDate` is called
 * hundreds of times per page render for table rows, tooltips, stat
 * cards, etc. A per-call formatter would burn real CPU. V8 maintains
 * a process-global formatter cache internally, so `new Intl.DateTimeFormat`
 * with identical args across calls is effectively free — consumers that
 * render many rows pay the cost once per locale.
 */
export function formatDate(date: string | Date, locale: Locale): string {
  const formatter = new Intl.DateTimeFormat(CLDR_LOCALES[locale], {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  return formatter.format(typeof date === "string" ? new Date(date) : date);
}

/**
 * Arbitrary-options date/time formatter for tooltips, chart axes, and
 * other places that need a custom `Intl.DateTimeFormatOptions` shape
 * beyond what `formatDate` exposes.
 *
 * @remarks
 * Preferred over `new Date(x).toLocaleString("uk-UA", opts)` anywhere in
 * the dashboard — the hardcoded `uk-UA` was a pre-i18n placeholder;
 * running through this helper picks up the active locale via the CLDR
 * mapping, so a future locale switch flips every tooltip / title /
 * axis label at once.
 */
export function formatDateTime(
  input: string | Date | number,
  options: Intl.DateTimeFormatOptions,
  locale: Locale,
): string {
  const formatter = new Intl.DateTimeFormat(CLDR_LOCALES[locale], options);
  const date = input instanceof Date ? input : new Date(input);
  // Defense-in-depth: `Intl.DateTimeFormat.format` throws a generic
  // `RangeError: Invalid time value` on a malformed Date, which buries
  // the actual culprit in the stack trace. Fail with the offending
  // input visible — a future bug like the bucket.t string-concat one
  // surfaces a self-explanatory message instead.
  if (Number.isNaN(date.getTime())) {
    throw new RangeError(`formatDateTime: invalid input ${JSON.stringify(input)}`);
  }
  return formatter.format(date);
}

/**
 * Thousands-grouped integer formatter for "big number" stat cards.
 * `1234` → `"1,234"` in `en-GB`; locale-appropriate separators for
 * other CLDR tags.
 */
export function formatCount(n: number, locale: Locale): string {
  const formatter = new Intl.NumberFormat(CLDR_LOCALES[locale]);
  return formatter.format(n);
}

/**
 * Capitalize a Prisma enum role for display: `"OWNER"` → `"Owner"`.
 * Used across role chips, dropdowns, toast messages, and email
 * templates. Looks up localized copy under `settings.orgs.roles.<key>.label`.
 */
export function formatRole(role: Role, t: RolesTranslator): string {
  const key = role.toLowerCase() as Lowercase<Role>;
  return t(`${key}.label`);
}

/**
 * Compact human-friendly duration. Extends naturally through seconds →
 * minutes → hours. Keeps two significant components max — "2h 15m",
 * never "2h 15m 30s". Trades precision for readability; the player has
 * its own frame-accurate formatter for the seek-bar.
 */
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

/**
 * Visually shorten a long identifier for table cells / chips. Default
 * keeps 8 chars + ellipsis — long enough to be unique within a typical
 * view but short enough to fit a column header. No locale needed —
 * pure numeric/string logic.
 */
export function truncateId(id: string, length = 8): string {
  return id.length > length ? `${id.slice(0, length)}...` : id;
}
