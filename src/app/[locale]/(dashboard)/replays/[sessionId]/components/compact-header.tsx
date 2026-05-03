import {
  ArrowsClockwiseIcon,
  BuildingsIcon,
  CalendarBlankIcon,
  ClockIcon,
  CopyIcon,
  HashIcon,
  MonitorIcon,
  UserIcon,
} from "@phosphor-icons/react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { Link } from "@/i18n/navigation";
import { Badge } from "@/components/ui/primitives/badge";
import { Button } from "@/components/ui/primitives/button";
import { Spinner } from "@/components/ui/feedback/spinner";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/overlays/tooltip";
import type { SessionDetail } from "@/api-client/sessions/types";
import { formatUpdateTooltip, type SessionUpdate } from "@/api-client/sessions/updates";
import { cn } from "@/lib/cn";
import { useFormatters } from "@/lib/use-formatters";

type CompactHeaderProps = {
  session: SessionDetail;
  /** Diff between snapshot and latest polled data. */
  updates: SessionUpdate[];
  onApply: () => void;
  isApplying: boolean;
};

export function CompactHeader({ session, updates, onApply, isApplying }: CompactHeaderProps) {
  const t = useTranslations("replays.detail");
  const { formatDate, formatDuration } = useFormatters();
  const screenSize =
    session.screenWidth && session.screenHeight ? `${session.screenWidth}×${session.screenHeight}` : null;

  const handleCopyId = () => {
    void navigator.clipboard.writeText(session.externalId);
    toast.success(t("copyIdSuccess"));
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Badge variant="secondary" className="gap-1.5 font-mono text-xs">
        <HashIcon size={12} />
        {session.externalId}
        <button
          type="button"
          onClick={handleCopyId}
          className="text-muted-foreground hover:text-foreground ml-0.5 cursor-pointer"
        >
          <CopyIcon size={12} />
        </button>
      </Badge>

      {session.trackedUserId && (
        <Badge variant="outline" className="gap-1.5" asChild>
          <Link href={`/users/${session.trackedUserId}`}>
            <UserIcon size={12} />
            {session.userId ?? t("anonymous")}
          </Link>
        </Badge>
      )}

      <Badge variant="outline" className="gap-1.5">
        <BuildingsIcon size={12} />
        {session.projectName}
      </Badge>

      <Badge variant="outline" className="gap-1.5">
        <ClockIcon size={12} />
        {formatDuration(session.duration)}
      </Badge>

      {screenSize && (
        <Badge variant="outline" className="gap-1.5">
          <MonitorIcon size={12} />
          {screenSize}
        </Badge>
      )}

      <Badge variant="outline" className="gap-1.5">
        <CalendarBlankIcon size={12} />
        {formatDate(session.createdAt)}
      </Badge>

      <RefreshButton updates={updates} onApply={onApply} isApplying={isApplying} />
    </div>
  );
}

type RefreshButtonProps = {
  updates: SessionUpdate[];
  onApply: () => void;
  isApplying: boolean;
};

/**
 * Hidden when idle — a permanent control trains the admin to tune it out.
 * `aria-live="polite"` announces the appearance to assistive tech.
 * "Reload" wording is deliberate — the click resets playback to t=0.
 */
function RefreshButton({ updates, onApply, isApplying }: RefreshButtonProps) {
  const t = useTranslations("replays.detail.refreshButton");
  const tTooltip = useTranslations("replays.detail.updateTooltip");
  const tooltip = formatUpdateTooltip(updates, tTooltip);
  const hasUpdates = updates.length > 0;

  // `isApplying` keeps the button mounted post-click even after `updates` empties — the transition needs a visible endpoint.
  if (!hasUpdates && !isApplying) return null;

  const ariaLabel = isApplying ? t("ariaReloading") : (tooltip ?? t("ariaReload"));

  return (
    <TooltipProvider delayDuration={0}>
      <div aria-live="polite" className="ml-auto inline-flex">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onApply}
              disabled={isApplying}
              aria-label={ariaLabel}
              className={cn(
                "gap-1.5",
                !isApplying &&
                  "border-orange-500/40 bg-orange-500/10 text-orange-500 hover:bg-orange-500/20 hover:text-orange-500",
              )}
            >
              {isApplying ? (
                <Spinner className="size-3.5 border" aria-hidden />
              ) : (
                <ArrowsClockwiseIcon size={14} aria-hidden />
              )}
              {!isApplying && <span aria-hidden className="size-1.5 animate-pulse rounded-full bg-orange-500" />}
              <span className="text-xs">{isApplying ? t("reloading") : t("reload")}</span>
            </Button>
          </TooltipTrigger>
          {tooltip && !isApplying && <TooltipContent>{tooltip}</TooltipContent>}
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}
