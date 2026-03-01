/**
 * Tracked-user activity status — isomorphic domain layer.
 *
 * @remarks
 * The activity-bucket question ("is this user online? active today?
 * idle? dormant?") has to resolve identically on the server (filter /
 * sort SQL) and the client (tooltip re-derivation, list row render).
 * Keeping the enum, thresholds, and derivation function here — in the
 * client-safe `api-client/` layer — means both sides import from the
 * same module and can never disagree on definitions.
 *
 * UI-facing tokens (labels, descriptions, Tailwind color classes) are
 * **not** here — they live colocated with the only page that renders
 * them at `src/app/(dashboard)/users/lib/status-ui.ts`. That split
 * keeps the domain file small and readable, and makes it impossible
 * for a route handler to accidentally pull in Tailwind class strings.
 *
 * Reuses `ONLINE_THRESHOLD_MS` from `./domain` so the online badge on
 * the detail page and the list page never disagree on what "online"
 * means.
 */

import { ONE_DAY_MS, SEVEN_DAYS_MS } from "@/lib/time";
import { ONLINE_THRESHOLD_MS } from "./domain";

export const USER_ACTIVITY_STATUSES = ["ONLINE", "ACTIVE_24H", "IDLE_7D", "DORMANT"] as const;
export type UserActivityStatus = (typeof USER_ACTIVITY_STATUSES)[number];

/**
 * Threshold boundaries in milliseconds. A user falls into the first
 * bucket whose threshold they fit within. `DORMANT` has no upper bound.
 */
export const STATUS_THRESHOLDS_MS = {
  ONLINE: ONLINE_THRESHOLD_MS,
  ACTIVE_24H: ONE_DAY_MS,
  IDLE_7D: SEVEN_DAYS_MS,
} as const satisfies Record<Exclude<UserActivityStatus, "DORMANT">, number>;

/**
 * Derive the activity status from the most recent event timestamp.
 *
 * @remarks
 * Pure function — no side effects, no network calls. Works identically
 * on the server (route handler) and the client (tooltip re-derivation).
 *
 * @param lastEventAt - ISO string or Date of the user's most recent event, or null if none.
 * @param now - Optional override for "now" (useful for deterministic tests).
 */
export function deriveUserStatus(lastEventAt: string | Date | null, now: Date = new Date()): UserActivityStatus {
  if (!lastEventAt) return "DORMANT";

  const elapsed = now.getTime() - new Date(lastEventAt).getTime();

  if (elapsed <= STATUS_THRESHOLDS_MS.ONLINE) return "ONLINE";
  if (elapsed <= STATUS_THRESHOLDS_MS.ACTIVE_24H) return "ACTIVE_24H";
  if (elapsed <= STATUS_THRESHOLDS_MS.IDLE_7D) return "IDLE_7D";
  return "DORMANT";
}

/**
 * Narrow an unknown query-param value into the `UserActivityStatus` union.
 *
 * @remarks
 * Returns `null` for invalid input — the caller decides whether to
 * treat that as "show all" or "bad request".
 */
export function parseUserStatus(raw: string): UserActivityStatus | null {
  return (USER_ACTIVITY_STATUSES as readonly string[]).includes(raw) ? (raw as UserActivityStatus) : null;
}
