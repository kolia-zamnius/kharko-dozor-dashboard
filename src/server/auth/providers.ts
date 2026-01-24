import "server-only";
import { resolveLocaleForUser } from "@/i18n/resolve-locale";
import { OTP_LENGTH } from "@/lib/auth/otp.constants";
import { bumpOtpRateLimit, otpEmailHtml, queryOtpRateLimit } from "@/server/auth/otp";
import { devLog } from "@/server/dev-log";
import { env } from "@/server/env";
import { sendMail } from "@/server/mailer";
import type { Provider } from "next-auth/providers";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";
import Nodemailer from "next-auth/providers/nodemailer";
import Passkey from "next-auth/providers/passkey";
import { getTranslations } from "next-intl/server";
import { randomInt } from "node:crypto";

/**
 * Auth.js providers configured for the dashboard.
 *
 * - **Google / GitHub** — OAuth, with `allowDangerousEmailAccountLinking`
 *   so users can sign in via either OAuth or OTP for the same email.
 * - **Nodemailer (email OTP)** — passwordless 6-digit code with two safeguards:
 *     1. `queryOtpRateLimit` (read) — bails before generating/sending if
 *        the user has hit the daily limit or is in cooldown.
 *     2. `prisma.otpRateLimit.upsert` (write) — increments the counter
 *        atomically AFTER the read passes. Prevents accidentally double-
 *        counting if the user retries while the email is in flight.
 * - **Passkey (WebAuthn)** — optional, gated by `experimental.enableWebAuthn`.
 */
export function createAuthProviders(): Provider[] {
  return [
    Google({ allowDangerousEmailAccountLinking: true }),
    GitHub({ allowDangerousEmailAccountLinking: true }),
    Nodemailer({
      server: { host: "smtp.gmail.com", port: 465, auth: { user: env.GMAIL_USER, pass: env.GMAIL_APP_PASSWORD } },
      from: `Kharko Dozor <${env.GMAIL_USER}>`,
      async generateVerificationToken() {
        const min = 10 ** (OTP_LENGTH - 1);
        const max = 10 ** OTP_LENGTH;
        return randomInt(min, max).toString();
      },
      async sendVerificationRequest({ identifier: email, token }) {
        const status = await queryOtpRateLimit(email);
        if (!status.allowed) {
          const reason = status.retryAfter ? "cooldown" : "daily_limit";
          devLog(`auth:otp_${reason}_blocked`, { email });
          throw new Error(status.retryAfter ? "OTP cooldown active" : "Daily OTP limit reached");
        }

        const { count } = await bumpOtpRateLimit(email);
        devLog("auth:otp_sending", { email, newCount: count });

        const locale = await resolveLocaleForUser(email);
        const t = await getTranslations({ locale, namespace: "emailOtp" });

        await sendMail({
          to: email,
          subject: t("subject", { token }),
          html: otpEmailHtml(token, locale, t),
        });
      },
    }),
    Passkey,
  ];
}
