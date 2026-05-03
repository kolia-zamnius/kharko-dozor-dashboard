import { useCallback, useRef, useState } from "react";
import { useShallow } from "zustand/react/shallow";

import { useFormatters } from "@/lib/use-formatters";
import { selectIsPlayerDisabled, usePlayerStore } from "../store";
import { formatTime } from "../utils";

/**
 * Re-renders ~60fps on `currentTime` ticks so the `useShallow` selector is
 * critical — narrow subscription means console-toggle/etc don't trigger here.
 * Tooltip shows wall-clock (`sessionStartTimestamp + currentTime`) so admins
 * can cross-reference replay moments with log timestamps.
 */
export function SeekBar() {
  const { currentTime, totalTime, idlePeriods, sessionStartTimestamp } = usePlayerStore(
    useShallow((s) => ({
      currentTime: s.currentTime,
      totalTime: s.totalTime,
      idlePeriods: s.idlePeriods,
      sessionStartTimestamp: s.sessionStartTimestamp,
    })),
  );
  const isDisabled = usePlayerStore(selectIsPlayerDisabled);
  const seek = usePlayerStore((s) => s.seek);
  const { formatDateTime } = useFormatters();
  const barRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const [showTooltip, setShowTooltip] = useState(false);

  const calcTime = useCallback(
    (clientX: number) => {
      const bar = barRef.current;
      if (!bar || totalTime === 0) return 0;
      const rect = bar.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      return ratio * totalTime;
    },
    [totalTime],
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (isDisabled) return;
      isDragging.current = true;
      setShowTooltip(true);
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      seek(calcTime(e.clientX));
    },
    [seek, calcTime, isDisabled],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDragging.current) return;
      seek(calcTime(e.clientX));
    },
    [seek, calcTime],
  );

  const handlePointerUp = useCallback(() => {
    isDragging.current = false;
    setShowTooltip(false);
  }, []);

  const progress = totalTime > 0 ? (currentTime / totalTime) * 100 : 0;

  const realTime =
    sessionStartTimestamp > 0
      ? formatDateTime(sessionStartTimestamp + currentTime, {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })
      : null;

  return (
    <div className="flex items-center gap-3">
      <span className="text-muted-foreground w-12 text-right font-mono text-xs">{formatTime(currentTime)}</span>
      <div
        ref={barRef}
        className="bg-muted relative h-1.5 flex-1 cursor-pointer rounded-full"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        {idlePeriods.map((period, i) => {
          const left = (period.start / totalTime) * 100;
          const width = ((period.end - period.start) / totalTime) * 100;
          return (
            <div
              key={i}
              className="absolute inset-y-0 rounded-full bg-amber-500/30"
              style={{ left: `${left}%`, width: `${width}%` }}
            />
          );
        })}

        <div className="bg-primary absolute inset-y-0 left-0 rounded-full" style={{ width: `${progress}%` }} />

        <div
          className="border-primary absolute top-1/2 h-3.5 w-3.5 -translate-y-1/2 rounded-full border-2 bg-white shadow-sm"
          style={{ left: `calc(${progress}% - 7px)` }}
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => {
            if (!isDragging.current) setShowTooltip(false);
          }}
        >
          {showTooltip && realTime && (
            <div className="bg-popover text-popover-foreground absolute bottom-full left-1/2 mb-2 -translate-x-1/2 rounded px-2 py-1 font-mono text-xs whitespace-nowrap shadow-md">
              {realTime}
            </div>
          )}
        </div>
      </div>
      <span className="text-muted-foreground w-12 font-mono text-xs">{formatTime(totalTime)}</span>
    </div>
  );
}
