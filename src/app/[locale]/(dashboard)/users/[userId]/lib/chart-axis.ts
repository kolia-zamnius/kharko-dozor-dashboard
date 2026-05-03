import type { ActivityRange } from "@/api-client/tracked-users/domain";
import type { Locale } from "@/i18n/config";
import { formatDateTime } from "@/lib/format";

// Shared between activity histogram + sessions timeline. `locale` is an
// explicit arg — helpers run inside `useMemo`, no `useLocale()` access.

/** 7 ticks — 6h → hourly, 24h → every 4h, 7d → daily + one extra. Denser crowds on mobile, sparser makes 7d reads ambiguous. */
export const AXIS_LABEL_COUNT = 7;

export function formatAxisTick(ms: number, range: ActivityRange, locale: Locale): string {
  if (range === "7d") {
    return formatDateTime(ms, { day: "2-digit", month: "2-digit" }, locale);
  }
  return formatDateTime(ms, { hour: "2-digit", minute: "2-digit" }, locale);
}

/** `position` is 0-100% — caller wires into `left: X%` with edge-clamped `translateX` so labels don't clip. */
export function buildAxisLabels(
  windowStart: number,
  windowEnd: number,
  range: ActivityRange,
  locale: Locale,
): Array<{ position: number; label: string }> {
  const span = windowEnd - windowStart;
  return Array.from({ length: AXIS_LABEL_COUNT }, (_, i) => {
    const t = windowStart + (span * i) / (AXIS_LABEL_COUNT - 1);
    return {
      position: (i / (AXIS_LABEL_COUNT - 1)) * 100,
      label: formatAxisTick(t, range, locale),
    };
  });
}
