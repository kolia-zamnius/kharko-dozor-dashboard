/**
 * Relative-time formatting helpers. Used across the dashboard for "5m ago",
 * "2h ago", "3d ago", and "in 2 days" labels.
 *
 * @remarks
 * Wraps `Intl.RelativeTimeFormat` with the staircase logic (seconds →
 * minutes → hours → days → months → years), centralised here so all
 * call sites agree on:
 *   - the "just now" threshold (< 5s abs → no RTF call)
 *   - the handoff points between units (seconds → minutes at 60s, etc.)
 *   - the locale-aware sub-minute copy (RTF renders "30 seconds ago",
 *     we want the terser "30s ago" / "just now" / "in 30s" — those
 *     three pieces of copy live in `common.relative.*`).
 *
 * Signed-delta convention: the seconds input is `now - target`
 * (positive = past), matching historical call sites (dataUpdatedAt
 * tickers, last-seen labels). Future-direction dates (expiresAt on
 * pending invites, scheduled runs) pass a negative delta and get
 * RTF's "in ..." rendering.
 */

import type { getTranslations } from "next-intl/server";

import type { Locale } from "@/i18n/config";
import { CLDR_LOCALES } from "@/lib/format";

/**
 * Scoped translator for `common.relative` — the three sub-minute copy
 * pieces RTF doesn't provide in the terse short-form we render.
 */
type RelativeTranslator = Awaited<ReturnType<typeof getTranslations<"common.relative">>>;

/**
 * Per-locale `Intl.RelativeTimeFormat` cache. Same logic as `formatDate`
 * — constructor is expensive, V8 caches internally, but avoiding
 * per-call allocation is still worth a module-scoped Map when this
 * fires once per row in a scrolling table.
 */
const relativeFormatterCache = new Map<string, Intl.RelativeTimeFormat>();

function getRelativeFormatter(cldrLocale: string): Intl.RelativeTimeFormat {
  let fmt = relativeFormatterCache.get(cldrLocale);
  if (!fmt) {
    fmt = new Intl.RelativeTimeFormat(cldrLocale, { numeric: "auto" });
    relativeFormatterCache.set(cldrLocale, fmt);
  }
  return fmt;
}

/**
 * Core stair-step formatter taking a seconds delta (positive = past,
 * negative = future). Exported for call sites that already have the
 * delta in seconds (e.g. live tickers that compare against a cached
 * `dataUpdatedAt`).
 */
export function formatRelativeFromSeconds(diffSec: number, locale: Locale, t: RelativeTranslator): string {
  const abs = Math.abs(diffSec);
  if (abs < 5) return t("justNow");

  // Sub-minute bucket keeps the original "30s ago" vernacular for past
  // deltas; future deltas pick up an "in 30s" sibling so "just now"
  // doesn't swallow a countdown that's still a real delay. Copy is
  // localised because RTF's own "30 seconds ago" is too verbose for
  // the places we render this (tables, tooltips, freshness pills).
  if (abs < 60) {
    return diffSec >= 0 ? t("secondsAgo", { count: abs }) : t("inSeconds", { count: abs });
  }

  // From here down, RTF handles both directions from a signed input:
  // positive → "... ago", negative → "in ...". Pass `-diffSec` because
  // our convention (positive = past) is the inverse of RTF's
  // (positive = future).
  const fmt = getRelativeFormatter(CLDR_LOCALES[locale]);

  const diffMin = Math.round(diffSec / 60);
  if (Math.abs(diffMin) < 60) return fmt.format(-diffMin, "minute");

  const diffHour = Math.round(diffMin / 60);
  if (Math.abs(diffHour) < 24) return fmt.format(-diffHour, "hour");

  const diffDay = Math.round(diffHour / 24);
  if (Math.abs(diffDay) < 30) return fmt.format(-diffDay, "day");

  const diffMonth = Math.round(diffDay / 30);
  if (Math.abs(diffMonth) < 12) return fmt.format(-diffMonth, "month");

  return fmt.format(-Math.round(diffMonth / 12), "year");
}

/**
 * Convenience wrapper for ISO-string call sites. Works bidirectionally —
 * past dates render as "5m ago", future dates as "in 2 days".
 */
export function formatRelative(iso: string, locale: Locale, t: RelativeTranslator): string {
  const diffSec = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  return formatRelativeFromSeconds(diffSec, locale, t);
}
