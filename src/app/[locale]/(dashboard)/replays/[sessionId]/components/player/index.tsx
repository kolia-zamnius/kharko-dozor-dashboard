import { useEffect, useMemo, useState } from "react";

import { useSessionEventsQuery } from "@/api-client/sessions/queries";
import type { SessionDetail } from "@/api-client/sessions/types";
import { Spinner } from "@/components/ui/feedback/spinner";
import { slice as runSlicer } from "@/lib/slicer";
import type { DozorEvent, Slice, SlicingCriteria } from "@/lib/slicer/types";
import { ConsolePanel } from "./console-panel";
import { ControlBar } from "./control-bar";
import { SlicePicker } from "./slice-picker";
import { usePlayerStore } from "./store";
import { decompressBatch, ensureMetaEvent } from "./utils";
import { Viewport } from "./viewport";

type PlayerProps = {
  session: SessionDetail;
};

const DEFAULT_CRITERIA: SlicingCriteria = { byUrl: true, idleGapMs: 60_000 };

// Owns the events-stream subscription, decompresses batches, derives slices via
// the slicer module, syncs into Zustand. Children read from the store — zero
// prop drilling. Slicing happens fully in the browser; the server just hands
// over the gzipped event blobs ordered by `firstTimestamp`.
export function Player({ session }: PlayerProps) {
  const { setSlices, setActiveSliceEvents, selectSlice } = usePlayerStore();
  const [allEvents, setAllEvents] = useState<DozorEvent[]>([]);
  const [decompressing, setDecompressing] = useState(true);

  const { data: eventsResponse } = useSessionEventsQuery(session.id);

  // Decompress + concat batches whenever the response changes.
  useEffect(() => {
    if (!eventsResponse) return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- response identity is the trigger; refetch must visibly reset to "decompressing".
    setDecompressing(true);
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
      }
    });
    return () => {
      cancelled = true;
    };
  }, [eventsResponse]);

  const slices: Slice[] = useMemo(
    () => (allEvents.length > 0 ? runSlicer(allEvents, DEFAULT_CRITERIA) : []),
    [allEvents],
  );

  useEffect(() => setSlices(slices), [slices, setSlices]);

  // Reset to slice 0 whenever the route's session changes — store outlives the route.
  useEffect(() => {
    selectSlice(0);
  }, [session.id, selectSlice]);

  const activeSliceIndex = usePlayerStore((s) => s.activeSliceIndex);
  const consoleOpen = usePlayerStore((s) => s.consoleOpen);

  const activeSlice = slices[activeSliceIndex] ?? null;

  const playerEvents = useMemo(() => {
    if (!activeSlice) return [];
    return ensureMetaEvent(activeSlice.events, activeSlice);
  }, [activeSlice]);

  useEffect(() => setActiveSliceEvents(playerEvents), [playerEvents, setActiveSliceEvents]);

  const showSlicePicker = slices.length > 1;
  const showLoading = decompressing || allEvents.length === 0;

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
        {showLoading ? (
          <div className="flex h-full items-center justify-center">
            <Spinner />
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
