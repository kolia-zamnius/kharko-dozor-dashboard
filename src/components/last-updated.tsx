"use client";

import { ArrowsClockwiseIcon } from "@phosphor-icons/react";
import { useIsFetching, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { Spinner } from "@/components/ui/feedback/spinner";
import { Button } from "@/components/ui/primitives/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/overlays/tooltip";
import { cn } from "@/lib/cn";
import { useFormatters } from "@/lib/use-formatters";

type LastUpdatedProps = {
  /** First element of the query key — every query starting with this prefix drives the indicator. */
  queryKeyPrefix: string;
  /** `dataUpdatedAt` from the primary query — drives the "Xs ago" label. */
  dataUpdatedAt: number;
  /** Auto-refresh interval in ms — surfaced in the tooltip copy. */
  pollIntervalMs: number;
};

/**
 * Live freshness pill + manual-refresh button. Ticks the "Updated Xs ago" label
 * every second; `useIsFetching` filtered by `queryKeyPrefix` flips it to
 * "Refreshing…" whenever any matching query is in flight, and the refresh
 * button invalidates the same prefix.
 *
 * Lives at `src/components/` (not `ui/`) because it carries TanStack + local
 * state — it's a container, not a presentational primitive.
 */
export function LastUpdated({ queryKeyPrefix, dataUpdatedAt, pollIntervalMs }: LastUpdatedProps) {
  const t = useTranslations("common.lastUpdated");
  const { formatRelativeFromSeconds, formatDateTime } = useFormatters();
  const queryClient = useQueryClient();
  const [now, setNow] = useState(() => Date.now());

  const fetchingCount = useIsFetching({
    predicate: (q) => Array.isArray(q.queryKey) && q.queryKey[0] === queryKeyPrefix,
  });
  const isRefreshing = fetchingCount > 0;

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(id);
  }, []);

  function handleRefresh() {
    void queryClient.invalidateQueries({
      predicate: (q) => Array.isArray(q.queryKey) && q.queryKey[0] === queryKeyPrefix,
    });
  }

  const diffSec = dataUpdatedAt > 0 ? Math.max(0, Math.round((now - dataUpdatedAt) / 1000)) : 0;
  const label = dataUpdatedAt > 0 ? formatRelativeFromSeconds(diffSec) : t("notYet");
  const intervalSec = Math.round(pollIntervalMs / 1000);
  const absoluteTime =
    dataUpdatedAt > 0 ? formatDateTime(dataUpdatedAt, { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : null;

  return (
    <TooltipProvider delayDuration={0}>
      <div className="text-muted-foreground flex items-center gap-2 text-xs">
        <Tooltip>
          <TooltipTrigger asChild>
            <span className={cn("inline-flex items-center gap-1.5", isRefreshing && "text-primary")} aria-live="polite">
              {isRefreshing ? (
                <Spinner className="size-3 border" aria-hidden />
              ) : (
                <span className="bg-muted-foreground/40 inline-block size-1.5 rounded-full" />
              )}
              <span className="tabular-nums">{isRefreshing ? t("refreshing") : t("updated", { label })}</span>
            </span>
          </TooltipTrigger>
          <TooltipContent>
            {absoluteTime
              ? t("tooltipWithTime", { time: absoluteTime, interval: intervalSec })
              : t("tooltipNoTime", { interval: intervalSec })}
          </TooltipContent>
        </Tooltip>

        <Button
          variant="ghost"
          size="icon-xs"
          onClick={handleRefresh}
          disabled={isRefreshing}
          aria-label={t("refreshAria")}
          title={t("refreshAria")}
        >
          <ArrowsClockwiseIcon weight="regular" className={cn(isRefreshing && "animate-spin")} />
        </Button>
      </div>
    </TooltipProvider>
  );
}
