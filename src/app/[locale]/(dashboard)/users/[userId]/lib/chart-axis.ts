import type { ActivityRange } from "@/api-client/tracked-users/domain";
import type { Locale } from "@/i18n/config";
import { formatDateTime } from "@/lib/format";

/**
 * Shared x-axis helpers for the activity histogram and sessions timeline.
 *
 * @remarks
 * Both charts render against the same `[windowStart, windowEnd]` span
 * in Unix milliseconds and the same {@link ActivityRange} enum, and
 * format ticks identically — "HH:mm" for sub-day windows, "DD.MM" for
 * the 7-day window. Extracting the helpers here keeps the two chart
 * files focused on layout and means a change to label formatting
 * is a one-line edit in this module instead of two out-of-sync ones.
 *
 * `locale` threads through as an explicit arg — the helpers live
 * outside any React render scope (`assignLanes` + `computeLayout`
 * call them synchronously from a `useMemo` body) and can't hit
 * `useLocale()` directly. Callers resolve locale via `useFormatters()`
 * and pass it down.
 *
 * @see ../components/activity/histogram.tsx — primary consumer.
 * @see ../components/sessions-timeline/index.tsx — second consumer.
 */

/**
 * How many x-axis tick labels to render across a chart.
 *
 * @remarks
 * Seven is a sweet spot across all three {@link ActivityRange} values:
 *   - `6h`  → tick every hour (0h, 1h, 2h, …)
 *   - `24h` → tick every 4 hours (a common reading unit)
 *   - `7d`  → daily labels with one endpoint extra (Mon → Sun + today)
 *
 * Denser labels crowd on mobile; sparser (≤ 4) makes 7-day reads
 * ambiguous. Picked once so both chart files agree.
 */
export const AXIS_LABEL_COUNT = 7;

/**
 * Render one axis tick — a date (`DD.MM`) for the weekly range, a
 * wall-clock time (`HH:mm`) for anything shorter.
 */
export function formatAxisTick(ms: number, range: ActivityRange, locale: Locale): string {
  if (range === "7d") {
    return formatDateTime(ms, { day: "2-digit", month: "2-digit" }, locale);
  }
  return formatDateTime(ms, { hour: "2-digit", minute: "2-digit" }, locale);
}

/**
 * Build a uniform axis-label set for a chart window.
 *
 * @remarks
 * Each entry carries a `position` (0-100 % of chart width) and a
 * preformatted `label`. The consumer wires `position` into an absolute
 * `left: X%` and applies a `translateX` that left-aligns the first
 * label and right-aligns the last, so chart edges don't clip text.
 *
 * @example
 * ```tsx
 * const axisLabels = buildAxisLabels(fromMs, toMs, range);
 * axisLabels.map((l) => (
 *   <span style={{ left: `${l.position}%` }}>{l.label}</span>
 * ));
 * ```
 */
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
