export const STATUS_POLL_INTERVAL_MS = 30_000;

/** Same value as detail by design — list and detail should feel equally live. */
export const USERS_LIST_POLL_MS = 30_000;

/**
 * User detail page (activity, sessions, detail). Tab-blurred skips polls via
 * `refetchIntervalInBackground: false` on the query factory.
 */
export const USER_PAGE_POLL_INTERVAL_MS = 30_000;
