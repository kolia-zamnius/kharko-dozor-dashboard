import { useTranslations } from "next-intl";
import { useEffect, useMemo, useRef } from "react";

import { Spinner } from "@/components/ui/feedback/spinner";
import { cn } from "@/lib/cn";

import { usePlayerStore } from "../store";
import { extractConsoleLogs, formatTimePrecise } from "../utils";

type ConsoleLogLevel = "error" | "warn" | "info" | "debug" | "log";

const LEVEL_STYLE = {
  error: "bg-destructive/10 text-destructive",
  warn: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  info: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
  debug: "text-muted-foreground",
  log: "",
} as const satisfies Record<ConsoleLogLevel, string>;

function styleForLevel(level: string): string {
  return level in LEVEL_STYLE ? LEVEL_STYLE[level as ConsoleLogLevel] : LEVEL_STYLE.log;
}

/**
 * Stick-to-bottom auto-scroll: only when the user was at the bottom on the last manual scroll,
 * so inspecting an earlier log isn't ripped away by the next append.
 */
export function ConsoleTab() {
  const t = useTranslations("replays.detail.player.console");
  const events = usePlayerStore((s) => s.events);
  const currentTime = usePlayerStore((s) => s.currentTime);
  const isLoading = events.length === 0;

  const containerRef = useRef<HTMLDivElement>(null);
  const wasAtBottomRef = useRef(true);

  const allLogs = useMemo(() => extractConsoleLogs(events), [events]);
  // Memo guards against per-frame reallocation: `currentTime` updates at ~60fps.
  const visibleLogs = useMemo(() => allLogs.filter((l) => l.timeOffset <= currentTime), [allLogs, currentTime]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || !wasAtBottomRef.current) return;
    el.scrollTop = el.scrollHeight;
  }, [visibleLogs.length]);

  const handleScroll = () => {
    const el = containerRef.current;
    if (!el) return;
    // 60px slack so a log taller than one line lands without breaking the tail-follow state.
    wasAtBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
  };

  return (
    <div className="flex h-full flex-col">
      <div className="text-muted-foreground shrink-0 border-b px-3 py-2 text-xs">
        {visibleLogs.length} / {allLogs.length}
      </div>
      <div ref={containerRef} onScroll={handleScroll} className="min-h-0 flex-1 overflow-y-auto font-mono text-xs">
        {isLoading ? (
          <div className="flex h-full items-center justify-center">
            <Spinner />
          </div>
        ) : visibleLogs.length === 0 ? (
          <div className="flex h-full items-center justify-center p-4">
            <p className="text-muted-foreground text-xs">{t("empty")}</p>
          </div>
        ) : (
          visibleLogs.map((log, i) => (
            <div key={i} className={cn("border-border/50 border-b px-3 py-1.5", styleForLevel(log.level))}>
              <span className="text-muted-foreground text-[10px]">{formatTimePrecise(log.timeOffset)}</span>
              <p className="break-all">{log.payload.join(" ")}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
