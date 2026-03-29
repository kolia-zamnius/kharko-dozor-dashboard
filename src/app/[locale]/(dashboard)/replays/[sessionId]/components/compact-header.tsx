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
  /** Diff between the player snapshot and latest polled data. */
  updates: SessionUpdate[];
  /** Called when the admin clicks the refresh button while updates exist. */
  onApply: () => void;
  /** True while the transition triggered by `onApply` is in flight. */
  isApplying: boolean;
};

/**
 * Compact session metadata bar above the viewport.
 *
 * All metadata shown as Badge elements with icons. Session ID is
 * displayed in full with a copy button. The trailing `<RefreshButton>`
 * lights up in orange when the background poll detects new slices /
 * events / an end-of-session flip — clicking it promotes the latest
 * data into the player (see `useSessionUpdateIndicator`).
 */
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
 * GitHub-style "updates available" button.
 *
 * Only visible when there's actually something to act on — a silent
 * idle state would add a permanent control to the header chrome for
 * no value and train the admin to tune it out. Hiding it entirely
 * means the orange "something changed" signal gets the full weight
 * of admin attention when it finally appears.
 *
 * Two visible states:
 *   1. **Has updates** — orange fill + ring + pulsing dot. Tooltip
 *      summarizes the diff ("2 new slices, 17 new events • Click to
 *      reload"). `aria-live="polite"` on the wrapper announces the
 *      button's appearance to assistive tech without being aggressive.
 *   2. **Applying** — spinner, disabled, so a double-click can't fire
 *      two remounts in quick succession. Stays mounted through the
 *      transition so the admin sees their click being honored before
 *      the button disappears once the snapshot catches up.
 *
 * The button is the ONLY place on the replay page where the admin
 * takes responsibility for resetting playback — the tooltip wording
 * is deliberate about "reload" so the consequence is advertised.
 */
function RefreshButton({ updates, onApply, isApplying }: RefreshButtonProps) {
  const t = useTranslations("replays.detail.refreshButton");
  const tTooltip = useTranslations("replays.detail.updateTooltip");
  const tooltip = formatUpdateTooltip(updates, tTooltip);
  const hasUpdates = updates.length > 0;

  // Hide entirely when there's nothing to do. `isApplying` keeps the
  // button mounted through a click-in-flight even after `updates`
  // empties out, so the transition has a visible endpoint.
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
