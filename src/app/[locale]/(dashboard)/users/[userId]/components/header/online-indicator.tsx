import { useTranslations } from "next-intl";

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/overlays/tooltip";
import { useUserStatusQuery } from "@/api-client/tracked-users/queries";
import { cn } from "@/lib/cn";
import { useFormatters } from "@/lib/use-formatters";

type OnlineIndicatorProps = {
  userId: string;
  /** Optional fallback used before the status query resolves. */
  fallbackLastSeenAt?: string | null;
};

/**
 * Live-updating online badge driven by `useUserStatusQuery`, which polls the
 * cheap `/status` endpoint on an interval (see `STATUS_POLL_INTERVAL_MS`).
 *
 * The query keeps its own cache and is independent of the detail query, so
 * polling doesn't churn the heavier payloads.
 */
export function OnlineIndicator({ userId, fallbackLastSeenAt }: OnlineIndicatorProps) {
  const t = useTranslations("users.detail.online");
  const { formatRelative, formatDateTime } = useFormatters();
  const { data } = useUserStatusQuery(userId);

  const online = data?.online ?? false;
  const lastEventAt = data?.lastEventAt ?? fallbackLastSeenAt ?? null;

  const label = online
    ? t("onlineNow")
    : lastEventAt
      ? t("lastSeen", { relative: formatRelative(lastEventAt) })
      : t("neverSeen");

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            role="status"
            aria-live="polite"
            aria-label={label}
            className="border-border bg-background text-muted-foreground inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium"
          >
            <span className="relative inline-flex size-2">
              <span
                className={cn("absolute inset-0 rounded-full", online ? "animate-ping bg-emerald-500/60" : "hidden")}
              />
              <span
                className={cn(
                  "relative inline-flex size-2 rounded-full",
                  online ? "bg-emerald-500" : "bg-muted-foreground/40",
                )}
              />
            </span>
            <span className={cn(online && "text-emerald-600 dark:text-emerald-400")}>{label}</span>
          </span>
        </TooltipTrigger>
        <TooltipContent>
          {lastEventAt
            ? t("tooltipLast", {
                time: formatDateTime(lastEventAt, { dateStyle: "short", timeStyle: "medium" }),
              })
            : t("tooltipNone")}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
