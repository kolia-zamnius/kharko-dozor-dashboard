/**
 * OTP configuration constants — shared between client and server.
 *
 * @remarks
 * The rate-limit and cooldown values live here so that the server-side
 * enforcement ({@link src/server/auth/otp.ts}) and the client-side
 * countdown UI ({@link src/app/(auth)/components/otp-verification.tsx})
 * can never drift out of sync. Changing any value here updates both
 * sides atomically on the next build.
 *
 * Client-safe (`src/lib/`) because neither constant touches Node APIs
 * or database state — they are pure numbers that shape UX copy and
 * server-side guards identically.
 */

/** Max number of OTP emails we send to a single address per rolling 24h window. */
export const OTP_DAILY_LIMIT = 5;

/** Minimum seconds between consecutive OTP sends for the same address. */
export const OTP_COOLDOWN_SECONDS = 60;

/** Length of the numeric OTP code emitted by the Nodemailer template. */
export const OTP_LENGTH = 6;
