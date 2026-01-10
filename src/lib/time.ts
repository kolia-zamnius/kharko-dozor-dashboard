/**
 * Time primitives in milliseconds — shared between server and client.
 *
 * @remarks
 * Client-safe (`src/lib/`) because the same multipliers are needed on
 * both sides of the boundary: server routes compute retention cutoffs
 * and invite TTL arithmetic; client `lib/data/*` derives activity /
 * status / date-range cutoffs for query keys. One source of truth
 * prevents drift — the kind of bug where the server window is 7 days
 * and the client cache key assumes 6.75 days because someone did
 * `6.75 * 24 * 60 * 60 * 1000` as a one-off.
 *
 * Only include durations that earn their place by being reused at
 * least twice. This is a de-duplication surface, not a calendar utility.
 */

export const ONE_SECOND_MS = 1_000;
export const ONE_MINUTE_MS = 60 * ONE_SECOND_MS;
export const ONE_HOUR_MS = 60 * ONE_MINUTE_MS;
export const ONE_DAY_MS = 24 * ONE_HOUR_MS;
export const SEVEN_DAYS_MS = 7 * ONE_DAY_MS;
export const THIRTY_DAYS_MS = 30 * ONE_DAY_MS;

/**
 * Retention window for raw `Session` rows before the nightly cron
 * hard-deletes them.
 *
 * @remarks
 * Lives in `src/lib/time.ts` (client-safe) rather than `src/app/api/_lib/constants.ts`
 * because the replays-list date-range filter anchors its widest preset
 * to this value — both sides (cron cutoff + client preset label) must
 * agree, so one constant drives both. Changing retention is a one-line
 * edit here; every caller re-derives its cutoff / label automatically.
 *
 * Sized to comfortably cover the "replay last week's regression" use
 * case without unbounded growth on the free tier. Paid tiers (when they
 * exist) will override this from the org row; this becomes the fallback
 * then. Cascades to slices + events via `onDelete: Cascade` in the
 * schema.
 */
export const SESSION_RETENTION_DAYS = 90;

export const SESSION_RETENTION_MS = SESSION_RETENTION_DAYS * ONE_DAY_MS;
