import {
  ArrowsLeftRightIcon,
  CopyIcon,
  IdentificationCardIcon,
  PauseIcon,
  PlayIcon,
  type Icon,
} from "@phosphor-icons/react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { assertNever } from "@/lib/assert-never";
import { cn } from "@/lib/cn";
import type { HistoryItem } from "@/lib/history/types";
import { useFormatters } from "@/lib/use-formatters";

type Props = {
  item: HistoryItem;
  isActive: boolean;
  onSelect: () => void;
};

const ICONS: Record<HistoryItem["kind"], Icon> = {
  init: PlayIcon,
  navigation: ArrowsLeftRightIcon,
  idle: PauseIcon,
  identify: IdentificationCardIcon,
};

/**
 * Outer is a `<div role="button">`, not a real `<button>`, so the inline copy action can be a
 * real `<button>` — nested `<button>` is invalid HTML. Enter/Space activate the row to preserve
 * native-button keyboard parity.
 */
export function HistoryItemRow({ item, isActive, onSelect }: Props) {
  const t = useTranslations("replays.detail.player.history");
  const { formatDuration } = useFormatters();
  const Icon = ICONS[item.kind];

  // `realDurationMs` carries the original gap regardless of timeline compression, so a 1 h idle
  // squashed to a 5 s blip still reads "59m 50s" in the feed. Floor at 1s — never show "0s".
  const durationSec = Math.max(1, Math.round(item.realDurationMs / 1000));

  let label: string;
  let copyableUrl: string | null;
  switch (item.kind) {
    case "init":
      label = item.url ?? item.pathname ?? t("kind.init");
      copyableUrl = item.url;
      break;
    case "navigation":
      label = item.url;
      copyableUrl = item.url;
      break;
    case "idle":
      label = t("kind.idle");
      copyableUrl = null;
      break;
    case "identify":
      label = t("kind.identify", { userId: item.userId });
      copyableUrl = null;
      break;
    default:
      assertNever(item);
  }

  const handleCopy = async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (!copyableUrl) return;
    try {
      await navigator.clipboard.writeText(copyableUrl);
      toast.success(t("copyUrlSuccess"));
    } catch {
      toast.error(t("copyUrlError"));
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onSelect();
    }
  };

  return (
    <div
      data-history-id={item.id}
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={handleKeyDown}
      className={cn(
        "flex w-full cursor-pointer items-start gap-2 border-l-2 px-3 py-2 text-left transition-colors",
        "focus-visible:outline-ring focus-visible:outline-2 focus-visible:-outline-offset-2",
        isActive ? "border-l-primary bg-primary/5 text-primary" : "hover:bg-muted/50 border-l-transparent",
      )}
    >
      <Icon
        size={14}
        weight={isActive ? "fill" : "regular"}
        className={cn("mt-0.5 shrink-0", isActive ? "text-primary" : "text-muted-foreground")}
      />
      {/* `break-all` not `break-words` — URLs have no whitespace, only character breaks fit them in 320px. */}
      <span className="min-w-0 flex-1 font-mono text-xs break-all">{label}</span>
      {copyableUrl && (
        <button
          type="button"
          onClick={handleCopy}
          aria-label={t("copyUrlAria")}
          className={cn(
            "mt-0.5 shrink-0 rounded p-0.5 transition-colors",
            "text-muted-foreground hover:bg-muted hover:text-foreground",
            "focus-visible:outline-ring focus-visible:outline-1",
          )}
        >
          <CopyIcon size={14} />
        </button>
      )}
      {item.kind !== "identify" && (
        <span className="text-muted-foreground mt-0.5 shrink-0 text-xs">{formatDuration(durationSec)}</span>
      )}
    </div>
  );
}
