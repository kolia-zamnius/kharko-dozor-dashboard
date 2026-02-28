/**
 * Shared invite-lifecycle constants.
 *
 * @remarks
 * Lives in `api-client/` (client-safe feature layer, no `server-only`
 * imports) so three consumers across the server/client boundary can
 * read the same number without any of them owning it:
 *
 *   - `src/app/api/organizations/[orgId]/invites/route.ts` (server)
 *       computes `expiresAt` from this constant when creating or
 *       refreshing an invite row.
 *   - `src/app/api/organizations/[orgId]/invites/_helpers/invite-email.ts`
 *       (server) interpolates it into the email copy so the recipient
 *       sees the same number that's written to the DB.
 *   - `.../org-card/invite-modal/new-invite-form.tsx` (client) shows
 *       a muted helper line on the admin-side invite form so the admin
 *       knows how long the link will live.
 *
 * If we ever want to let individual orgs configure their own expiry
 * window, this constant becomes a default and the three consumers read
 * from Organization settings instead. Centralizing now makes that swap
 * a three-file change instead of a grep-across-the-repo.
 */

/**
 * How long a PENDING invite stays valid before the daily cron cleanup
 * deletes it. Chosen as a product tradeoff: short enough that stale
 * invites don't pollute the DB for weeks, long enough to cover a full
 * weekend + a Monday morning catch-up for most recipients. Combined
 * with the idempotent "resend or create" semantics of the invite route,
 * an admin can extend the window on demand simply by clicking Invite
 * again — no manual revoke, no new token.
 */
export const INVITE_EXPIRY_DAYS = 3;

/**
 * Maximum number of invite sends a single signed-in user can trigger
 * per UTC day. Enforced server-side via `assertInviteRateLimit` in the
 * `POST /api/organizations/[orgId]/invites` route.
 *
 * @remarks
 * Caps blast radius if an OWNER account gets compromised — without
 * this gate, an attacker with a valid session can fan out thousands
 * of invite emails to harass random addresses AND exhaust the shared
 * Gmail SMTP quota (~500/day on free tier), which would also block
 * legitimate OTP sign-ins for every other user until the day rolls
 * over. 100 covers realistic large-team onboarding (bringing on 50
 * interns in one sitting, with headroom for resends) while staying
 * well under the Gmail ceiling so abusive sends trip this guard long
 * before they touch the SMTP quota.
 *
 * Bumped atomically after a successful invite create + email dispatch
 * (not before) so a DB / SMTP failure doesn't burn the admin's quota
 * on a send that never happened.
 */
export const INVITE_DAILY_LIMIT = 100;
