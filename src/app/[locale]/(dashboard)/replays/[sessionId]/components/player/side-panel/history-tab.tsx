import { useTranslations } from "next-intl";
import { useEffect, useRef } from "react";
import { useShallow } from "zustand/react/shallow";

import { Spinner } from "@/components/ui/feedback/spinner";

import { usePlayerStore } from "../store";
import { HistoryItemRow } from "./history-item";

export function HistoryTab() {
  const t = useTranslations("replays.detail.player.history");
  const { historyItems, activeHistoryItemId, sessionStartTimestamp } = usePlayerStore(
    useShallow((s) => ({
      historyItems: s.historyItems,
      activeHistoryItemId: s.activeHistoryItemId,
      sessionStartTimestamp: s.sessionStartTimestamp,
    })),
  );
  const seek = usePlayerStore((s) => s.seek);
  const containerRef = useRef<HTMLDivElement>(null);

  // `block: "nearest"` keeps already-visible rows put — no jitter when the new active is on screen.
  useEffect(() => {
    if (!activeHistoryItemId) return;
    const node = containerRef.current?.querySelector<HTMLElement>(`[data-history-id="${activeHistoryItemId}"]`);
    node?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [activeHistoryItemId]);

  const isLoading = historyItems.length === 0;

  return (
    <div className="flex h-full flex-col">
      <div className="text-muted-foreground shrink-0 border-b px-3 py-2 text-xs">
        {t("count", { count: historyItems.length })}
      </div>
      <div ref={containerRef} className="min-h-0 flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex h-full items-center justify-center">
            <Spinner />
          </div>
        ) : (
          historyItems.map((item) => (
            <HistoryItemRow
              key={item.id}
              item={item}
              isActive={item.id === activeHistoryItemId}
              onSelect={() => seek(Math.max(0, item.startedAt - sessionStartTimestamp))}
            />
          ))
        )}
      </div>
    </div>
  );
}
