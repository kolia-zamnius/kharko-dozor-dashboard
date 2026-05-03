import type { DozorContextState } from "@kharko/dozor-react";

/** Exhaustive switch — TS errors if the union grows. */
export function describePlaygroundState(state: DozorContextState): string {
  switch (state) {
    case "not_initialized":
      return "Not initialized";
    case "idle":
      return "Idle (initialized, not recording)";
    case "recording":
      return "Recording";
    case "paused":
      return "Paused";
  }
}
