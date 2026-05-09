/**
 * Activity-status enum + thresholds + derivation. Server (filter / sort SQL) and
 * client (tooltip re-derivation, list row render) import from here so the two
 * sides can never disagree on what each bucket means. UI tokens (labels, color
 * classes) live colocated with the page at
 * `src/app/[locale]/(dashboard)/users/lib/status-ui.ts`.
 */

import { ONE_DAY_MS, ONE_MINUTE_MS, SEVEN_DAYS_MS } from "@/lib/time";

/**
 * Online if last event lands within this window. Server-side filter + client-side
 * badge consume the same threshold so the two views can never disagree.
 */
export const ONLINE_THRESHOLD_MS = 2 * ONE_MINUTE_MS;

export const USER_ACTIVITY_STATUSES = ["ONLINE", "ACTIVE_24H", "IDLE_7D", "DORMANT"] as const;
export type UserActivityStatus = (typeof USER_ACTIVITY_STATUSES)[number];

/** First bucket whose threshold the user fits within. `DORMANT` has no upper bound. */
export const STATUS_THRESHOLDS_MS = {
  ONLINE: ONLINE_THRESHOLD_MS,
  ACTIVE_24H: ONE_DAY_MS,
  IDLE_7D: SEVEN_DAYS_MS,
} as const satisfies Record<Exclude<UserActivityStatus, "DORMANT">, number>;

export function deriveUserStatus(lastEventAt: string | Date | null, now: Date = new Date()): UserActivityStatus {
  if (!lastEventAt) return "DORMANT";

  const elapsed = now.getTime() - new Date(lastEventAt).getTime();

  if (elapsed <= STATUS_THRESHOLDS_MS.ONLINE) return "ONLINE";
  if (elapsed <= STATUS_THRESHOLDS_MS.ACTIVE_24H) return "ACTIVE_24H";
  if (elapsed <= STATUS_THRESHOLDS_MS.IDLE_7D) return "IDLE_7D";
  return "DORMANT";
}

/** Returns `null` for invalid input — caller decides "show all" vs "bad request". */
export function parseUserStatus(raw: string): UserActivityStatus | null {
  return (USER_ACTIVITY_STATUSES as readonly string[]).includes(raw) ? (raw as UserActivityStatus) : null;
}
