import { ArrowsLeftRightIcon, PauseIcon, PlayIcon } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";

import { cn } from "@/lib/cn";
import { useFormatters } from "@/lib/use-formatters";
import { usePlayerStore } from "./store";

const REASON_ICONS = {
  init: PlayIcon,
  url: ArrowsLeftRightIcon,
  idle: PauseIcon,
} as const;

const REASON_KEYS = {
  init: "reasonInit",
  url: "reasonUrl",
  idle: "reasonIdle",
} as const;

export function SlicePicker() {
  const t = useTranslations("replays.detail.player.slicePicker");
  const { formatDuration } = useFormatters();
  const slices = usePlayerStore((s) => s.slices);
  const activeIndex = usePlayerStore((s) => s.activeSliceIndex);
  const selectSlice = usePlayerStore((s) => s.selectSlice);

  return (
    <div className="flex items-center gap-1.5 overflow-x-auto py-1">
      {slices.map((slice, index) => {
        const Icon = REASON_ICONS[slice.reason];
        const isActive = index === activeIndex;
        const label = t(REASON_KEYS[slice.reason]);

        return (
          <button
            key={slice.id}
            type="button"
            title={t("tooltip", {
              reason: label,
              pathname: slice.pathname ?? "",
              duration: formatDuration(slice.duration),
              events: slice.events.length,
            })}
            onClick={() => selectSlice(index)}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm transition-colors disabled:pointer-events-none disabled:opacity-50",
              isActive ? "border-primary bg-primary/10 text-primary" : "border-border hover:border-foreground/30",
            )}
          >
            <Icon size={14} weight={isActive ? "fill" : "regular"} />
            <span className="max-w-30 truncate font-mono text-xs">{slice.pathname ?? "—"}</span>
            <span className="text-muted-foreground">{formatDuration(slice.duration)}</span>
          </button>
        );
      })}
    </div>
  );
}
