import {
  ClockClockwiseIcon,
  ClockCounterClockwiseIcon,
  FastForwardIcon,
  PauseIcon,
  PlayIcon,
  SkipForwardIcon,
  TerminalWindowIcon,
} from "@phosphor-icons/react";
import { useTranslations } from "next-intl";
import { useShallow } from "zustand/react/shallow";

import { Button } from "@/components/ui/primitives/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/overlays/popover";
import { cn } from "@/lib/cn";
import { selectIsPlayerDisabled, usePlayerStore } from "../store";
import { SeekBar } from "./seek-bar";

const SPEED_OPTIONS = [0.5, 1, 2] as const;

/**
 * Replay control bar — reads preference fields via `useShallow` so a
 * `currentTime` tick (60 fps) doesn't re-render the whole bar, and
 * pulls the disabled gate from {@link selectIsPlayerDisabled} so the
 * "idle or mid-slice-load" contract stays in one place (see store.ts).
 */
export function ControlBar() {
  const t = useTranslations("replays.detail.player.control");
  const { state, speed, skipInactive, autoContinue, consoleOpen } = usePlayerStore(
    useShallow((s) => ({
      state: s.state,
      speed: s.speed,
      skipInactive: s.skipInactive,
      autoContinue: s.autoContinue,
      consoleOpen: s.consoleOpen,
    })),
  );
  const isDisabled = usePlayerStore(selectIsPlayerDisabled);
  const { play, pause, seek, setSpeed, toggleSkipInactive, toggleAutoContinue, toggleConsole } = usePlayerStore();

  const isPlaying = state === "playing";

  return (
    <div className="bg-card space-y-2 rounded-b-lg border border-t-0 px-4 py-3">
      <SeekBar />

      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          onClick={isPlaying ? pause : play}
          disabled={isDisabled}
          aria-label={isPlaying ? t("pause") : t("play")}
        >
          {isPlaying ? <PauseIcon size={16} weight="fill" /> : <PlayIcon size={16} weight="fill" />}
        </Button>

        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          onClick={() => {
            const { currentTime } = usePlayerStore.getState();
            seek(Math.max(0, currentTime - 5000));
          }}
          disabled={isDisabled}
          aria-label={t("backFive")}
        >
          <ClockCounterClockwiseIcon size={16} />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          onClick={() => {
            const { currentTime, totalTime } = usePlayerStore.getState();
            seek(Math.min(totalTime, currentTime + 5000));
          }}
          disabled={isDisabled}
          aria-label={t("forwardFive")}
        >
          <ClockClockwiseIcon size={16} />
        </Button>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="sm" className="font-mono text-xs" disabled={isDisabled}>
              {speed}x
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-20 p-1">
            {SPEED_OPTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSpeed(s)}
                className={cn(
                  "hover:bg-muted flex w-full items-center justify-center rounded-md px-2 py-1 font-mono text-sm transition-colors",
                  speed === s && "bg-muted font-medium",
                )}
              >
                {s}x
              </button>
            ))}
          </PopoverContent>
        </Popover>

        <Button
          variant={skipInactive ? "secondary" : "ghost"}
          size="sm"
          className="gap-1"
          onClick={toggleSkipInactive}
          disabled={isDisabled}
          aria-label={t("skipIdleAria")}
          aria-pressed={skipInactive}
        >
          <FastForwardIcon size={14} />
          <span className="hidden sm:inline">{t("skipIdle")}</span>
        </Button>

        <Button
          variant={autoContinue ? "secondary" : "ghost"}
          size="sm"
          className="gap-1"
          onClick={toggleAutoContinue}
          disabled={isDisabled}
          aria-label={t("autoPlayAria")}
          aria-pressed={autoContinue}
        >
          <SkipForwardIcon size={14} />
          <span className="hidden sm:inline">{t("autoPlay")}</span>
        </Button>

        <div className="flex-1" />

        <Button
          variant={consoleOpen ? "secondary" : "ghost"}
          size="sm"
          className="gap-1"
          onClick={toggleConsole}
          disabled={isDisabled}
          aria-label={t("consoleAria")}
          aria-pressed={consoleOpen}
        >
          <TerminalWindowIcon size={14} />
          <span className="hidden sm:inline">{t("console")}</span>
        </Button>
      </div>
    </div>
  );
}
