import { useTranslations } from "next-intl";
import { useEffect, useRef } from "react";
import { usePlayerStore } from "../store";
import type { ReplayerHandle } from "../types";
import { REPLAYER_CSS } from "./replayer-css";

/**
 * Two layers of isolation: Shadow DOM (replayer CSS can't be touched by
 * dashboard Tailwind) + rrweb's internal iframe (recorded DOM sandboxed).
 * Auto-scale via two `ResizeObserver`s (iframe + container) computing
 * `min(cw/rw, ch/rh)`. `pointer-events-none` on host blocks interaction
 * with recorded content.
 */
export function Viewport() {
  const t = useTranslations("replays.detail.player");
  const events = usePlayerStore((s) => s.events);
  const onReplayerReady = usePlayerStore((s) => s.onReplayerReady);
  const hostRef = useRef<HTMLDivElement>(null);
  const shadowRootRef = useRef<ShadowRoot | null>(null);
  const replayerRef = useRef<unknown>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    // rrweb's `Replayer` throws "need at least 2 events" when seeded below floor —
    // a defense-in-depth guard alongside the server-side throwaway-session filter.
    if (!host || events.length < 2) return;

    let active = true;
    let iframeObserver: ResizeObserver | null = null;
    let containerObserver: ResizeObserver | null = null;

    // Create Shadow DOM on first mount (persists across re-renders).
    if (!shadowRootRef.current) {
      shadowRootRef.current = host.attachShadow({ mode: "open" });

      const style = document.createElement("style");
      style.textContent = REPLAYER_CSS;
      shadowRootRef.current.appendChild(style);

      const container = document.createElement("div");
      container.style.cssText = "width:100%;height:100%;overflow:hidden;position:relative;";
      shadowRootRef.current.appendChild(container);
      containerRef.current = container;
    }

    const container = containerRef.current!;

    // Clear previous replayer content (keep style).
    while (container.firstChild) container.removeChild(container.firstChild);

    const rrwebEvents = events.map((e) => ({
      type: e.type,
      data: e.data,
      timestamp: e.timestamp,
    }));

    void import("rrweb").then(({ Replayer }) => {
      if (!active) return;

      const replayer = new Replayer(rrwebEvents, {
        root: container,
        skipInactive: false,
        showWarning: false,
        mouseTail: { duration: 500, strokeStyle: "rgba(99, 102, 241, 0.4)" },
      });

      replayerRef.current = replayer;

      // Auto-scale: contain mode preserving aspect ratio.
      const wrapper = replayer.wrapper;
      const iframe = replayer.iframe;
      if (wrapper && iframe) {
        const applyScale = () => {
          if (!active) return;
          const replayWidth = iframe.offsetWidth;
          const replayHeight = iframe.offsetHeight;
          if (!replayWidth || !replayHeight) return;

          const containerWidth = container.clientWidth;
          const containerHeight = container.clientHeight;
          const scale = Math.min(containerWidth / replayWidth, containerHeight / replayHeight);

          wrapper.style.transform = `scale(${scale})`;
          wrapper.style.transformOrigin = "top left";
          wrapper.style.position = "absolute";
          wrapper.style.left = `${(containerWidth - replayWidth * scale) / 2}px`;
          wrapper.style.top = `${(containerHeight - replayHeight * scale) / 2}px`;
        };

        // Observe both iframe and container for size changes.
        iframeObserver = new ResizeObserver(applyScale);
        iframeObserver.observe(iframe);
        containerObserver = new ResizeObserver(applyScale);
        containerObserver.observe(container);
        applyScale();
      }

      // Expose handle to parent.
      const handle: ReplayerHandle = {
        play: (t) => replayer.play(t),
        pause: (t) => replayer.pause(t),
        getCurrentTime: () => replayer.getCurrentTime(),
        getMetaData: () => replayer.getMetaData(),
        setConfig: (config) => replayer.setConfig(config),
        on: (event, handler) => replayer.on(event, handler),
      };
      onReplayerReady(handle);
    });

    return () => {
      active = false;
      // Disconnect observers explicitly (don't rely on GC).
      iframeObserver?.disconnect();
      containerObserver?.disconnect();
      const replayer = replayerRef.current as { destroy?: () => void } | null;
      if (replayer?.destroy) {
        replayer.destroy();
        replayerRef.current = null;
      }
    };
  }, [events, onReplayerReady]);

  if (events.length < 2) {
    return (
      <div className="bg-muted flex h-full items-center justify-center">
        <p className="text-muted-foreground text-sm">{t("empty")}</p>
      </div>
    );
  }

  return <div ref={hostRef} className="bg-muted pointer-events-none h-full w-full overflow-hidden" />;
}
