/**
 * Invite-lifecycle constants. Read by both server (invite route + email body) and
 * client (admin-side invite form helper line).
 */

/**
 * PENDING invite TTL before the nightly cron deletes it. Short enough not to
 * clutter, long enough for weekend + Monday catch-up. Resending is idempotent: an
 * admin extends the window by clicking Invite again — no manual revoke needed.
 */
export const INVITE_EXPIRY_DAYS = 3;

/**
 * Per-signed-in-user-per-UTC-day cap. Enforced by `assertInviteRateLimit` in
 * `POST /api/organizations/[orgId]/invites`, bumped only after a successful send
 * (so a DB / SMTP failure doesn't burn quota). Caps blast radius if an OWNER
 * session is compromised — sized to fit large-team onboarding while staying well
 * under Gmail SMTP's ~500/day limit, so abusive sends trip this guard long before
 * they touch the SMTP quota.
 */
export const INVITE_DAILY_LIMIT = 100;
