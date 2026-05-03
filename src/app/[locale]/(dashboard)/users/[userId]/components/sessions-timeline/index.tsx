import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { useMemo } from "react";

import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/layout/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/overlays/tooltip";
import type { UserTimeline } from "@/api-client/tracked-users/types";
import { type ActivityRange } from "@/api-client/tracked-users/domain";
import type { Locale } from "@/i18n/config";
import { cn } from "@/lib/cn";
import { formatDateTime } from "@/lib/format";
import { useFormatters } from "@/lib/use-formatters";
import { buildAxisLabels } from "../../lib/chart-axis";
import { assignLanes } from "./assign-lanes";

type SessionsTimelineProps = {
  data: UserTimeline;
  range: ActivityRange;
};

const LANE_HEIGHT = 22;
/** Compact gap — concurrent-session days can push lane count past 4-5; larger gaps push the card below the fold. */
const LANE_GAP = 4;

/** Locale arg is explicit — helper lives outside the render scope, no `useLocale()`. */
function formatAbsolute(iso: string, locale: Locale): string {
  return formatDateTime(iso, { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }, locale);
}

/**
 * `assignLanes` does greedy interval scheduling — minimum lanes for concurrent
 * sessions. Open sessions (`endedAt: null`) extend to the window edge in
 * emerald — the only colour signal, sparse so the wall doesn't become a traffic light.
 */
export function SessionsTimeline({ data, range }: SessionsTimelineProps) {
  const t = useTranslations("users.detail.timeline");
  const tActivity = useTranslations("users.activity");
  const { formatDuration, truncateId, locale } = useFormatters();
  const layout = useMemo(() => computeLayout(data, locale), [data, locale]);

  if (layout.lanes.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t("title")}</CardTitle>
          <CardAction>
            <span className="text-muted-foreground text-xs">{tActivity(`${range}.shortLabel`)}</span>
          </CardAction>
        </CardHeader>
        <CardContent className="pb-5">
          <div className="border-border text-muted-foreground flex h-20 items-center justify-center rounded-md border border-dashed text-sm">
            {t("empty")}
          </div>
        </CardContent>
      </Card>
    );
  }

  const { lanes, windowStart, windowEnd, axisLabels } = layout;
  const totalSessions = lanes.reduce((n, l) => n + l.length, 0);
  const chartHeight = lanes.length * LANE_HEIGHT + Math.max(0, lanes.length - 1) * LANE_GAP;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <CardAction>
          <span className="text-muted-foreground text-xs tabular-nums">
            {t("summary", {
              count: totalSessions,
              lanes: lanes.length,
              range: tActivity(`${range}.shortLabel`),
            })}
          </span>
        </CardAction>
      </CardHeader>
      <CardContent className="pb-5">
        <TooltipProvider delayDuration={0}>
          <div
            role="img"
            aria-label={t("ariaLabel", { count: totalSessions, lanes: lanes.length })}
            className="relative w-full"
            style={{ height: chartHeight }}
          >
            {lanes.map((lane, laneIdx) => (
              <div
                key={laneIdx}
                className="absolute inset-x-0"
                style={{ top: laneIdx * (LANE_HEIGHT + LANE_GAP), height: LANE_HEIGHT }}
              >
                {/* Lane track background */}
                <div className="bg-muted/30 absolute inset-0 rounded-sm" />

                {/* Session bars */}
                {lane.map((session) => {
                  const span = windowEnd - windowStart;
                  const leftPct = ((session.visualStart - windowStart) / span) * 100;
                  const widthPct = Math.max(0.4, ((session.visualEnd - session.visualStart) / span) * 100);
                  const isOpen = session.endedAt === null;
                  const durationStr =
                    session.duration > 0
                      ? formatDuration(session.duration)
                      : isOpen
                        ? t("ongoing")
                        : t("lessThanSecond");

                  return (
                    <Tooltip key={session.id}>
                      <TooltipTrigger asChild>
                        <Link
                          href={`/replays/${session.id}`}
                          aria-label={t("sessionAria", {
                            id: truncateId(session.externalId, 12),
                            duration: durationStr,
                          })}
                          className={cn(
                            "group absolute top-0.5 h-[calc(100%-4px)] rounded-sm outline-none",
                            "bg-primary/60 hover:bg-primary focus-visible:bg-primary focus-visible:ring-ring/50 focus-visible:ring-2",
                            isOpen && "bg-emerald-500/60 hover:bg-emerald-500",
                          )}
                          style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                        />
                      </TooltipTrigger>
                      <TooltipContent side="top">
                        <div className="space-y-0.5 text-xs">
                          <p className="font-mono font-medium">{truncateId(session.externalId, 16)}</p>
                          <p className="text-background/70">
                            {formatAbsolute(session.startedAt, locale)}
                            {session.endedAt ? ` — ${formatAbsolute(session.endedAt, locale)}` : ` — ${t("ongoing")}`}
                          </p>
                          <p className="text-background/70">
                            {durationStr} · {t("sliceCount", { count: session.slices.length })}
                          </p>
                          <p className="text-background/50 pt-1">{t("clickToReplay")}</p>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  );
                })}
              </div>
            ))}
          </div>

          {/* X-axis labels */}
          <div className="relative mt-2 h-4 w-full">
            {axisLabels.map((l, i) => (
              <span
                key={i}
                className="text-muted-foreground absolute top-0 text-[10px] tabular-nums"
                style={{
                  left: `${l.position}%`,
                  transform:
                    i === 0 ? undefined : i === axisLabels.length - 1 ? "translateX(-100%)" : "translateX(-50%)",
                }}
              >
                {l.label}
              </span>
            ))}
          </div>
        </TooltipProvider>
      </CardContent>
    </Card>
  );
}

function computeLayout(data: UserTimeline, locale: Locale) {
  const windowStart = new Date(data.from).getTime();
  const windowEnd = new Date(data.to).getTime();
  const lanes = assignLanes(data.sessions, windowStart, windowEnd);
  const axisLabels = buildAxisLabels(windowStart, windowEnd, data.range, locale);
  return { lanes, windowStart, windowEnd, axisLabels };
}
