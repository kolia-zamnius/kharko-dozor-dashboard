import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";

import { useSessionEventsQuery } from "@/api-client/sessions/queries";
import type { SessionDetail } from "@/api-client/sessions/schemas";
import { Spinner } from "@/components/ui/feedback/spinner";
import { buildHistory } from "@/lib/history";
import { compressIdleEvents } from "@/lib/history/compress";
import type { DozorEvent } from "@/lib/history/types";
import { cn } from "@/lib/cn";
import { useFullscreen } from "@/lib/hooks/use-fullscreen";

import { ControlBar } from "./control-bar";
import { SidePanel } from "./side-panel";
import { usePlayerStore } from "./store";
import { decompressBatch, ensureMetaEvent } from "./utils";
import { Viewport } from "./viewport";

type PlayerProps = {
  session: SessionDetail;
};

const HISTORY_IDLE_GAP_MS = 30_000;
const COMPRESS_CAP_MS = 5_000;

/**
 * Composition root for the replay viewer. Fetches + decompresses the event stream, runs idle
 * compression when enabled, derives the History feed, and pushes everything into the Zustand
 * store. Children read from the store — zero prop drilling.
 */
export function Player({ session }: PlayerProps) {
  const t = useTranslations("replays.detail.player");
  const setEvents = usePlayerStore((s) => s.setEvents);
  const setHistoryItems = usePlayerStore((s) => s.setHistoryItems);
  const resetForSession = usePlayerStore((s) => s.resetForSession);
  const compressIdle = usePlayerStore((s) => s.compressIdle);
  const sidePanelVisible = usePlayerStore((s) => s.sidePanelVisible);

  const {
    ref: fullscreenRef,
    isFullscreen,
    isSupported: fullscreenSupported,
    toggle: toggleFullscreen,
  } = useFullscreen<HTMLDivElement>();

  const [allEvents, setAllEvents] = useState<DozorEvent[]>([]);
  const [decompressing, setDecompressing] = useState(true);
  const [decompressError, setDecompressError] = useState(false);

  const { data: eventsResponse } = useSessionEventsQuery(session.id);

  useEffect(() => {
    resetForSession();
  }, [session.id, resetForSession]);

  useEffect(() => {
    if (!eventsResponse) return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- response identity is the trigger; refetch must visibly reset to "decompressing".
    setDecompressing(true);
    setDecompressError(false);
    (async () => {
      const decoded = await Promise.all(eventsResponse.batches.map((b) => decompressBatch(b.data)));
      if (cancelled) return;
      const flat = decoded.flat().sort((a, b) => a.timestamp - b.timestamp);
      setAllEvents(flat);
      setDecompressing(false);
    })().catch((err) => {
      if (!cancelled) {
        console.error("Player: failed to decompress event batches", err);
        setDecompressing(false);
        setDecompressError(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [eventsResponse]);

  const viewport = useMemo(
    () => ({ width: session.screenWidth, height: session.screenHeight }),
    [session.screenWidth, session.screenHeight],
  );

  const compressedResult = useMemo(() => {
    if (!compressIdle || allEvents.length === 0) return null;
    return compressIdleEvents(allEvents, HISTORY_IDLE_GAP_MS, COMPRESS_CAP_MS);
  }, [allEvents, compressIdle]);

  const playerEvents = useMemo(() => {
    const sourceEvents = compressedResult?.events ?? allEvents;
    if (sourceEvents.length === 0) return [];
    return ensureMetaEvent(sourceEvents, session.url, viewport);
  }, [allEvents, compressedResult, session.url, viewport]);

  useEffect(() => setEvents(playerEvents), [playerEvents, setEvents]);

  const historyItems = useMemo(() => {
    if (allEvents.length === 0) return [];
    // Build off ORIGINAL events so `realDurationMs` records the true gap; remap timestamps into
    // the compressed timeline below if compression is on.
    const items = buildHistory(allEvents, {
      idleGapMs: HISTORY_IDLE_GAP_MS,
      initialUrl: session.url,
      sessionEndedAt: session.endedAt ? new Date(session.endedAt).getTime() : undefined,
    });
    if (!compressedResult) return items;
    return items.map((item) => ({
      ...item,
      startedAt: compressedResult.mapToCompressed(item.startedAt),
      endedAt: compressedResult.mapToCompressed(item.endedAt),
    }));
  }, [allEvents, session.url, session.endedAt, compressedResult]);

  useEffect(() => setHistoryItems(historyItems), [historyItems, setHistoryItems]);

  return (
    <div
      ref={fullscreenRef}
      className="fullscreen:bg-background fullscreen:flex fullscreen:h-screen fullscreen:flex-col"
    >
      <div
        className={cn(
          "bg-muted in-fullscreen:flex-1 in-fullscreen:rounded-none in-fullscreen:border-0 in-fullscreen:lg:aspect-auto overflow-hidden rounded-t-lg border lg:grid lg:aspect-video",
          sidePanelVisible ? "lg:grid-cols-[1fr_320px]" : "lg:grid-cols-1",
        )}
      >
        <div className="in-fullscreen:aspect-auto aspect-video lg:aspect-auto lg:h-full">
          {decompressError ? (
            <div className="flex h-full items-center justify-center">
              <p className="text-muted-foreground text-sm">{t("decompressError")}</p>
            </div>
          ) : decompressing ? (
            <div className="flex h-full items-center justify-center">
              <Spinner />
            </div>
          ) : allEvents.length === 0 ? (
            <div className="flex h-full items-center justify-center">
              <p className="text-muted-foreground text-sm">{t("empty")}</p>
            </div>
          ) : (
            <Viewport />
          )}
        </div>
        {sidePanelVisible && (
          <div className="bg-card in-fullscreen:max-h-none flex max-h-96 min-h-0 flex-col overflow-hidden border-t lg:h-full lg:max-h-none lg:border-t-0 lg:border-l">
            <SidePanel />
          </div>
        )}
      </div>
      <ControlBar
        isFullscreen={isFullscreen}
        fullscreenSupported={fullscreenSupported}
        onToggleFullscreen={toggleFullscreen}
      />
    </div>
  );
}
