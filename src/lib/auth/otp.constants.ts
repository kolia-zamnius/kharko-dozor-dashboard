/**
 * Shared between server enforcement ({@link src/server/auth/otp/rate-limit.ts})
 * and the client countdown UI ({@link src/app/[locale]/(auth)/components/otp-verification.tsx})
 * — single source so the two sides can't drift.
 */

export const OTP_DAILY_LIMIT = 5;
export const OTP_COOLDOWN_SECONDS = 60;
export const OTP_LENGTH = 6;
