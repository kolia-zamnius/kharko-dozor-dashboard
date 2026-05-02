import { TerminalWindowIcon } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useRef } from "react";

import { Spinner } from "@/components/ui/feedback/spinner";
import { cn } from "@/lib/cn";
import { usePlayerStore } from "./store";
import { extractConsoleLogs, formatTimePrecise } from "./utils";

/**
 * Console-log level → Tailwind class name. Closed key set so adding a
 * new level here is a compile error at every consumer that needs to
 * route it.
 */
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
 * Console log viewer — extracts console plugin events from the session,
 * filters to entries at or before the current playback time, and
 * follows the tail when the user is scrolled to the bottom.
 *
 * @remarks
 * Uses the "stick to bottom" pattern: we only auto-scroll when the
 * user was already at the bottom on their last manual scroll. Once
 * they scroll up to inspect an earlier log, we stop following — so
 * mid-replay inspection isn't ripped away by the next log append.
 * Reads `events`, `currentTime`, and `isSliceLoading` from the player
 * store; zero props.
 */
export function ConsolePanel() {
  const t = useTranslations("replays.detail.player.console");
  const events = usePlayerStore((s) => s.events);
  const currentTime = usePlayerStore((s) => s.currentTime);
  const isLoading = usePlayerStore((s) => s.isSliceLoading);

  const containerRef = useRef<HTMLDivElement>(null);
  const wasAtBottomRef = useRef(true);

  const allLogs = useMemo(() => extractConsoleLogs(events), [events]);
  // `currentTime` ticks at ~60fps via RAF in the player store. Without
  // memoisation, `allLogs.filter(...)` allocates a fresh array every
  // frame, defeating React's stable-reference reconciliation and
  // hammering the main thread on long sessions.
  const visibleLogs = useMemo(
    () => allLogs.filter((l) => l.timeOffset <= currentTime),
    [allLogs, currentTime],
  );

  useEffect(() => {
    const el = containerRef.current;
    if (!el || !wasAtBottomRef.current) return;
    el.scrollTop = el.scrollHeight;
  }, [visibleLogs.length]);

  const handleScroll = () => {
    const el = containerRef.current;
    if (!el) return;
    // 60px slack so the "near bottom" state survives one extra log
    // landing while the user was at the tail — without it, the tail
    // follow would break the moment a log taller than one line lands.
    wasAtBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
  };

  return (
    <div className="flex h-full flex-col overflow-hidden border-l">
      <div className="flex shrink-0 items-center justify-between border-b px-3 py-2">
        <div className="text-muted-foreground flex items-center gap-1.5 text-xs font-medium">
          <TerminalWindowIcon size={14} />
          {t("title")}
        </div>
        <span className="text-muted-foreground text-xs">
          {visibleLogs.length} / {allLogs.length}
        </span>
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
