import type { DozorContextState } from "@kharko/dozor-react";

/**
 * Human-readable label for the SDK's lifecycle state.
 *
 * @remarks
 * Pure switch over the discriminated union — TypeScript exhaustiveness
 * check fires if the union ever grows a new variant and this function
 * isn't updated. Lives in its own file so the orchestrator file ends
 * cleanly at `export default` without trailing helpers below it.
 */
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
