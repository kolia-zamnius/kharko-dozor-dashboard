import { useEffect, useMemo } from "react";

import { Spinner } from "@/components/ui/feedback/spinner";
import { useSliceEventsQuery } from "@/api-client/sessions/queries";
import type { SessionDetail } from "@/api-client/sessions/types";
import { ConsolePanel } from "./console-panel";
import { ControlBar } from "./control-bar";
import { SlicePicker } from "./slice-picker";
import { usePlayerStore } from "./store";
import { ensureMetaEvent } from "./utils";
import { Viewport } from "./viewport";

type PlayerProps = {
  session: SessionDetail;
};

/** Owns slice-events subscription, syncs into Zustand. Children read from the store — zero prop drilling. */
export function Player({ session }: PlayerProps) {
  const { setSlices, setEvents, setSliceLoading } = usePlayerStore();

  const slices = session.slices;
  useEffect(() => setSlices(slices ?? []), [slices, setSlices]);

  const activeSliceIndex = usePlayerStore((s) => s.activeSliceIndex);
  const consoleOpen = usePlayerStore((s) => s.consoleOpen);

  const hasSlices = slices.length > 0;
  const activeSlice = slices.find((s) => s.index === activeSliceIndex) ?? null;
  const { data: sliceEvents, isLoading: isSliceLoading } = useSliceEventsQuery(session.id, activeSliceIndex);

  const playerEvents = useMemo(() => {
    if (hasSlices && sliceEvents && activeSlice) {
      return ensureMetaEvent(sliceEvents, activeSlice);
    }
    if (!hasSlices) return session.events;
    return [];
  }, [session, hasSlices, sliceEvents, activeSlice]);

  useEffect(() => setEvents(playerEvents), [playerEvents, setEvents]);
  useEffect(() => setSliceLoading(hasSlices && isSliceLoading), [hasSlices, isSliceLoading, setSliceLoading]);

  const showSlicePicker = hasSlices && slices.length > 1;
  const showLoading = hasSlices && isSliceLoading;

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
          <Viewport key={activeSliceIndex} />
        )}
        {consoleOpen && <ConsolePanel />}
      </div>

      <ControlBar />
    </div>
  );
}
