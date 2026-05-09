export const SESSIONS_LIST_POLL_MS = 30_000;

/**
 * Replay page (active-watching surface). Tab-blurred skips polls via
 * `refetchIntervalInBackground: false`. Ended sessions are frozen — the query
 * factory turns the interval off dynamically when `endedAt !== null`.
 */
export const SESSION_DETAIL_POLL_MS = 10_000;
