import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { useShallow } from "zustand/react/shallow";

import { useSessionEventsQuery } from "@/api-client/sessions/queries";
import type { SessionDetail } from "@/api-client/sessions/schemas";
import { Spinner } from "@/components/ui/feedback/spinner";
import { slice as runSlicer } from "@/lib/slicer";
import type { DozorEvent, Slice } from "@/lib/slicer/types";
import { ConsolePanel } from "./console-panel";
import { ControlBar } from "./control-bar";
import { SlicePicker } from "./slice-picker";
import { usePlayerStore } from "./store";
import { decompressBatch, ensureMetaEvent } from "./utils";
import { Viewport } from "./viewport";

type PlayerProps = {
  session: SessionDetail;
};

const SLICE_DEFAULTS = { byUrl: true, idleGapMs: 60_000 } as const;

// Composition root: owns the events-stream fetch + decompression + slicing,
// pushes results into Zustand. Children read from the store — zero prop
// drilling. Slicing happens fully in the browser; the server hands over
// gzipped event blobs ordered by `firstTimestamp`.
export function Player({ session }: PlayerProps) {
  const t = useTranslations("replays.detail.player");
  // `useShallow` over the actions so action-identity changes never re-render `Player`. Without it
  // selecting the whole store re-runs this component on every 60fps `currentTime` tick.
  const { setSlices, setActiveSliceEvents, selectSlice } = usePlayerStore(
    useShallow((s) => ({
      setSlices: s.setSlices,
      setActiveSliceEvents: s.setActiveSliceEvents,
      selectSlice: s.selectSlice,
    })),
  );
  const [allEvents, setAllEvents] = useState<DozorEvent[]>([]);
  const [decompressing, setDecompressing] = useState(true);
  const [decompressError, setDecompressError] = useState(false);

  const { data: eventsResponse } = useSessionEventsQuery(session.id);

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

  const slices: Slice[] = useMemo(
    () => (allEvents.length > 0 ? runSlicer(allEvents, { ...SLICE_DEFAULTS, initialUrl: session.url }) : []),
    [allEvents, session.url],
  );

  useEffect(() => setSlices(slices), [slices, setSlices]);

  // Reset to slice 0 whenever the route's session changes — store outlives the route.
  useEffect(() => {
    selectSlice(0);
  }, [session.id, selectSlice]);

  const activeSliceIndex = usePlayerStore((s) => s.activeSliceIndex);
  const consoleOpen = usePlayerStore((s) => s.consoleOpen);

  const activeSlice = slices[activeSliceIndex] ?? null;
  const viewport = useMemo(
    () => ({ width: session.screenWidth, height: session.screenHeight }),
    [session.screenWidth, session.screenHeight],
  );

  const playerEvents = useMemo(() => {
    if (!activeSlice) return [];
    return ensureMetaEvent(activeSlice.events, activeSlice, viewport);
  }, [activeSlice, viewport]);

  useEffect(() => setActiveSliceEvents(playerEvents), [playerEvents, setActiveSliceEvents]);

  const showSlicePicker = slices.length > 1;

  return (
    <div>
      {showSlicePicker && (
        <div className="mb-4">
          <SlicePicker />
        </div>
      )}

      <div
        className={
          consoleOpen
            ? "bg-muted aspect-video overflow-hidden rounded-t-lg border lg:grid lg:grid-cols-[1fr_320px]"
            : "bg-muted aspect-video overflow-hidden rounded-t-lg border"
        }
      >
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
          <Viewport key={activeSlice?.id ?? activeSliceIndex} />
        )}
        {consoleOpen && <ConsolePanel />}
      </div>

      <ControlBar />
    </div>
  );
}
