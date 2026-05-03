import "server-only";

import { OTP_COOLDOWN_SECONDS, OTP_DAILY_LIMIT } from "@/lib/auth/otp.constants";
import { prisma } from "@/server/db/client";

/**
 * OTP rate-limit. Read + write kept in one file so the counter key
 * (`email + UTC day`) can't drift. `queryOtpRateLimit` runs twice per send —
 * pre-flight on the sign-in form and safety net inside the Nodemailer provider.
 * `bumpOtpRateLimit` runs only after the read returns `allowed: true`.
 */

export type OtpRateLimitStatus = { allowed: true } | { allowed: false; retryAfter?: number };

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
