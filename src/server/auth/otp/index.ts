import "server-only";

/**
 * Public surface of the OTP subsystem.
 *
 * @remarks
 * Consumers import from `@/server/auth/otp` and never have to think
 * about whether they want rate-limit logic or the email template —
 * the sub-files stay split for maintenance (domain logic vs ~70-line
 * HTML stylesheet) but look like one module from the outside.
 */
export { queryOtpRateLimit, bumpOtpRateLimit, type OtpRateLimitStatus } from "./rate-limit";
export { otpEmailHtml } from "./email-template";
