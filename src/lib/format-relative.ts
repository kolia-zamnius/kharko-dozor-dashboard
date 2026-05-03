/**
 * Wraps `Intl.RelativeTimeFormat` with a stair-step staircase (seconds → minutes →
 * hours → days → months → years) and three custom sub-minute strings — RTF's own
 * "30 seconds ago" is too verbose for the tables and pills we render this in.
 * Module-scoped formatter cache because this fires once per row.
 *
 * Signed-delta convention: positive = past (`now - target`). Future-direction dates
 * (invite expiry, scheduled runs) pass a negative delta and pick up RTF's "in ..."
 * rendering automatically.
 */

import type { getTranslations } from "next-intl/server";

import type { Locale } from "@/i18n/config";
import { CLDR_LOCALES } from "@/lib/format";

type RelativeTranslator = Awaited<ReturnType<typeof getTranslations<"common.relative">>>;

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
 * Exported for call sites that already have the delta in seconds — e.g. live tickers
 * comparing against a cached `dataUpdatedAt`.
 */
export function formatRelativeFromSeconds(diffSec: number, locale: Locale, t: RelativeTranslator): string {
  const abs = Math.abs(diffSec);
  if (abs < 5) return t("justNow");

  if (abs < 60) {
    return diffSec >= 0 ? t("secondsAgo", { count: abs }) : t("inSeconds", { count: abs });
  }

  // RTF takes signed input (positive = future) — our convention is the inverse, so pass `-diffSec`.
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

export function formatRelative(iso: string, locale: Locale, t: RelativeTranslator): string {
  const diffSec = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  return formatRelativeFromSeconds(diffSec, locale, t);
}
