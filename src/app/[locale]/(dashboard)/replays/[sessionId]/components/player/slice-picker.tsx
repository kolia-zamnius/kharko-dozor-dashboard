import { ArrowsLeftRightIcon, PauseIcon, PlayIcon } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";

import { cn } from "@/lib/cn";
import { useFormatters } from "@/lib/use-formatters";
import { usePlayerStore } from "./store";

const REASON_ICONS: Record<string, typeof PlayIcon> = {
  init: PlayIcon,
  idle: PauseIcon,
  navigation: ArrowsLeftRightIcon,
};

const REASON_KEYS: Record<string, "reasonInit" | "reasonIdle" | "reasonNavigation"> = {
  init: "reasonInit",
  idle: "reasonIdle",
  navigation: "reasonNavigation",
};

export function SlicePicker() {
  const t = useTranslations("replays.detail.player.slicePicker");
  const { formatDuration } = useFormatters();
  const slices = usePlayerStore((s) => s.slices);
  const activeIndex = usePlayerStore((s) => s.activeSliceIndex);
  const isLoading = usePlayerStore((s) => s.isSliceLoading);
  const selectSlice = usePlayerStore((s) => s.selectSlice);

  return (
    <div className="flex items-center gap-1.5 overflow-x-auto py-1">
      {slices.map((slice) => {
        const Icon = REASON_ICONS[slice.reason] ?? PlayIcon;
        const isActive = slice.index === activeIndex;
        const reasonKey = REASON_KEYS[slice.reason];
        const label = reasonKey ? t(reasonKey) : slice.reason;

        return (
          <button
            key={slice.index}
            type="button"
            title={t("tooltip", {
              reason: label,
              pathname: slice.pathname,
              duration: formatDuration(slice.duration),
              events: slice.eventCount,
            })}
            onClick={() => selectSlice(slice.index)}
            disabled={isLoading}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm transition-colors disabled:pointer-events-none disabled:opacity-50",
              isActive ? "border-primary bg-primary/10 text-primary" : "border-border hover:border-foreground/30",
            )}
          >
            <Icon size={14} weight={isActive ? "fill" : "regular"} />
            <span className="max-w-30 truncate font-mono text-xs">{slice.pathname}</span>
            <span className="text-muted-foreground">{formatDuration(slice.duration)}</span>
          </button>
        );
      })}
    </div>
  );
}
