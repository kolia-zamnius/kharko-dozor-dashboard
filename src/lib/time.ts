/**
 * Time primitives shared between server and client. Single source so the two sides
 * can't drift (server retention cutoff vs client cache-key window). Inclusion gate:
 * a duration earns its place by being reused at least twice — this is a
 * de-duplication surface, not a calendar utility.
 */

export const ONE_SECOND_MS = 1_000;
export const ONE_MINUTE_MS = 60 * ONE_SECOND_MS;
export const ONE_HOUR_MS = 60 * ONE_MINUTE_MS;
export const ONE_DAY_MS = 24 * ONE_HOUR_MS;
export const SEVEN_DAYS_MS = 7 * ONE_DAY_MS;
export const THIRTY_DAYS_MS = 30 * ONE_DAY_MS;

/**
 * Drives both the nightly cron's hard-delete cutoff AND the replays-list "last 90
 * days" preset label — single edit here updates both sides. Cascades to slices +
 * events via `onDelete: Cascade` in the schema.
 */
export const SESSION_RETENTION_DAYS = 90;

export const SESSION_RETENTION_MS = SESSION_RETENTION_DAYS * ONE_DAY_MS;
