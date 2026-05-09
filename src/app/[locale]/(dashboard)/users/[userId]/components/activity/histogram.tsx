import { useTranslations } from "next-intl";
import { useMemo } from "react";

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/overlays/tooltip";
import type { ActivityBucket, UserActivity } from "@/api-client/tracked-users/schemas";
import { type ActivityRange } from "@/api-client/tracked-users/domain";
import type { Locale } from "@/i18n/config";
import { cn } from "@/lib/cn";
import { formatDateTime } from "@/lib/format";
import { useFormatters } from "@/lib/use-formatters";
import { buildAxisLabels } from "../../lib/chart-axis";
import { buildBucketGrid } from "./bucket-grid";

type ActivityHistogramProps = {
  data: UserActivity;
  range: ActivityRange;
};

/** 7d adds a date prefix so adjacent buckets stay unambiguous across midnight. */
function formatBucketRange(bucket: ActivityBucket, bucketMs: number, range: ActivityRange, locale: Locale): string {
  // `bucket.t` is ISO — coerce to ms BEFORE `+ bucketMs` so it's numeric, not string concat.
  const startMs = new Date(bucket.t).getTime();
  const endMs = startMs + bucketMs;
  const timeOpts: Intl.DateTimeFormatOptions = { hour: "2-digit", minute: "2-digit" };
  const startStr = formatDateTime(startMs, timeOpts, locale);
  const endStr = formatDateTime(endMs, timeOpts, locale);

  if (range === "7d") {
    const dateStr = formatDateTime(startMs, { day: "2-digit", month: "2-digit" }, locale);
    return `${dateStr} ${startStr}–${endStr}`;
  }
  return `${startStr}–${endStr}`;
}

/**
 * `buildBucketGrid` materialises empty slots so sparse activity reads as a
 * shape, not a broken chart. Heights normalised against peak so short
 * sessions stay visible next to busy ones. Top-5 pathnames come precomputed
 * from the `/activity` endpoint.
 */
export function ActivityHistogram({ data, range }: ActivityHistogramProps) {
  const t = useTranslations("users.detail.activityChart");
  const { formatCount, locale } = useFormatters();
  const buckets = useMemo(() => buildBucketGrid(data), [data]);

  const maxTotal = useMemo(() => {
    let m = 0;
    for (const b of buckets) if (b.total > m) m = b.total;
    return m;
  }, [buckets]);

  const axisLabels = useMemo(
    () => buildAxisLabels(new Date(data.from).getTime(), new Date(data.to).getTime(), range, locale),
    [data.from, data.to, range, locale],
  );

  if (maxTotal === 0) {
    return (
      <div className="border-border text-muted-foreground flex h-48 items-center justify-center rounded-md border border-dashed text-sm">
        {t("empty")}
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={0}>
      {/* Chart area + bars. Role=img with a short summary gives screen readers a useful fallback. */}
      <div
        role="img"
        aria-label={t("ariaLabel", {
          events: formatCount(data.summary.totalEvents),
          buckets: buckets.length,
          peak: formatCount(maxTotal),
        })}
        className="relative h-48 w-full"
      >
        {/* Subtle horizontal gridlines at 25%, 50%, 75% for reference */}
        <div className="pointer-events-none absolute inset-0 flex flex-col justify-between">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="bg-border/50 h-px w-full" />
          ))}
        </div>

        <div className="relative flex h-full items-end gap-px">
          {buckets.map((b, i) => {
            const heightPct = maxTotal > 0 ? (b.total / maxTotal) * 100 : 0;
            const hasEvents = b.total > 0;

            return (
              <Tooltip key={i}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    aria-label={t("bucketAria", {
                      range: formatBucketRange(b, data.bucketMs, range, locale),
                      count: b.total,
                    })}
                    className="group focus-visible:ring-ring/50 relative flex h-full min-w-0 flex-1 cursor-default items-end rounded-sm outline-none focus-visible:ring-2"
                  >
                    <span
                      className={cn(
                        "w-full rounded-sm transition-colors",
                        hasEvents
                          ? "bg-primary/60 group-hover:bg-primary group-focus-visible:bg-primary"
                          : "bg-muted/40 group-hover:bg-muted",
                      )}
                      style={{
                        height: hasEvents ? `${Math.max(heightPct, 2)}%` : "2px",
                      }}
                    />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs">
                  <div className="space-y-1">
                    <p className="font-medium">{formatBucketRange(b, data.bucketMs, range, locale)}</p>
                    <p className="text-background/70">{t("tooltipEvents", { count: b.total })}</p>
                    {b.byPage.length > 0 && (
                      <ul className="text-background/80 space-y-0.5 pt-1 font-mono text-[10px]">
                        {b.byPage.map((p) => (
                          <li key={p.pathname} className="flex items-center justify-between gap-3">
                            <span className="truncate">{p.pathname}</span>
                            <span className="shrink-0 tabular-nums">{formatCount(p.count)}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>
      </div>

      {/* X-axis labels */}
      <div className="relative mt-2 h-4 w-full">
        {axisLabels.map((l, i) => (
          <span
            key={i}
            className="text-muted-foreground absolute top-0 text-[10px] tabular-nums"
            style={{
              left: `${l.position}%`,
              transform: i === 0 ? undefined : i === axisLabels.length - 1 ? "translateX(-100%)" : "translateX(-50%)",
            }}
          >
            {l.label}
          </span>
        ))}
      </div>
    </TooltipProvider>
  );
}
