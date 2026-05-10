import { useCallback, useState } from "react";
import { create } from "zustand";

type FullscreenStore = {
  fullscreenElement: Element | null;
  isSupported: boolean;
};

/** Single document-level listener feeds the store regardless of consumer count. */
const useFullscreenStore = create<FullscreenStore>(() => ({
  fullscreenElement: typeof document !== "undefined" ? document.fullscreenElement : null,
  isSupported: typeof document !== "undefined" && document.fullscreenEnabled,
}));

if (typeof document !== "undefined") {
  document.addEventListener("fullscreenchange", () => {
    useFullscreenStore.setState({ fullscreenElement: document.fullscreenElement });
  });
}

/**
 * `isSupported` is `false` on iOS Safari (no arbitrary element fullscreen) and inside iframes
 * without `allow="fullscreen"`.
 *
 * Callback ref + `useState` (not `useRef`) so the attached element is observable — comparing
 * against `document.fullscreenElement` happens on reactive state, never on `ref.current` during
 * render.
 */
export function useFullscreen<T extends HTMLElement = HTMLDivElement>() {
  const [element, setElement] = useState<T | null>(null);
  const fullscreenElement = useFullscreenStore((s) => s.fullscreenElement);
  const isSupported = useFullscreenStore((s) => s.isSupported);
  const isFullscreen = element !== null && fullscreenElement === element;

  const toggle = useCallback(async () => {
    if (!element) return;
    try {
      if (document.fullscreenElement === element) {
        await document.exitFullscreen();
      } else {
        await element.requestFullscreen();
      }
    } catch {
      // Browser denial (missing user gesture, iframe permissions) — caller has no recourse.
    }
  }, [element]);

  return { ref: setElement, isFullscreen, isSupported, toggle };
}
