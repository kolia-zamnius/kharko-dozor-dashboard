import "server-only";

import { OTP_COOLDOWN_SECONDS, OTP_DAILY_LIMIT } from "@/lib/auth/otp.constants";
import { prisma } from "@/server/db/client";

/**
 * OTP rate-limit read + write — the domain-logic half of the OTP pipeline.
 *
 * @remarks
 * Two operations that belong side-by-side because skipping either
 * breaks the rate-limit invariant:
 *
 *   - `queryOtpRateLimit` — pure read. Returns `{ allowed: false }`
 *     when the user has hit the daily cap, or `{ allowed: false,
 *     retryAfter }` when they're inside the cooldown window. Used
 *     by both the server action (pre-flight check on the sign-in
 *     page) and by the Nodemailer provider (safety net on the
 *     actual send).
 *   - `bumpOtpRateLimit` — atomic upsert keyed on `email + UTC day`.
 *     Runs AFTER the read passes, right before we hand the email to
 *     `sendMail`. Previously lived inline inside `providers.ts` —
 *     moved here so read and write can never drift (if the counter
 *     key shape changes, you edit one file, not two).
 *
 * @see src/lib/auth/otp.constants.ts — daily limit + cooldown values
 *   shared with the client countdown UI.
 */

export type OtpRateLimitStatus = { allowed: true } | { allowed: false; retryAfter?: number };

/** Pure read — checks daily limit and cooldown, does NOT increment. */
export async function queryOtpRateLimit(email: string): Promise<OtpRateLimitStatus> {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const record = await prisma.otpRateLimit.findUnique({
    where: { email_date: { email, date: today } },
  });

  if (record && record.count >= OTP_DAILY_LIMIT) {
    return { allowed: false };
  }

  if (record) {
    const secondsSince = (Date.now() - record.updatedAt.getTime()) / 1000;
    if (secondsSince < OTP_COOLDOWN_SECONDS) {
      return { allowed: false, retryAfter: Math.ceil(OTP_COOLDOWN_SECONDS - secondsSince) };
    }
  }

  return { allowed: true };
}

/**
 * Atomically increment the per-email-per-day counter.
 *
 * @remarks
 * Upsert keeps the first send of the day O(1) and every subsequent
 * send a single-row update. Returns the post-increment count so
 * callers can log the remaining quota without a follow-up read.
 */
export async function bumpOtpRateLimit(email: string): Promise<{ count: number }> {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const updated = await prisma.otpRateLimit.upsert({
    where: { email_date: { email, date: today } },
    update: { count: { increment: 1 } },
    create: { email, date: today, count: 1 },
  });

  return { count: updated.count };
}
