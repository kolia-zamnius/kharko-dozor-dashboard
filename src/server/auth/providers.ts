import "server-only";
import { resolveLocaleForUser } from "@/i18n/resolve-locale";
import { OTP_LENGTH } from "@/lib/auth/otp.constants";
import { bumpOtpRateLimit, otpEmailHtml, queryOtpRateLimit } from "@/server/auth/otp";
import { env } from "@/server/env";
import { log } from "@/server/logger";
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
 *   The `server` config object is required by Auth.js's Nodemailer
 *   provider but we override `sendVerificationRequest` entirely and
 *   route every send through our shared `sendMail` helper, so the
 *   `server` value is never actually used at runtime — it's a marker
 *   to satisfy the provider schema.
 * - **Passkey (WebAuthn)** — optional, gated by `experimental.enableWebAuthn`.
 *
 * Why this is its own module: providers are the largest section of the
 * NextAuth config and the one most likely to change (adding/removing
 * providers, tweaking OTP messaging, etc.). Pulling them out keeps
 * `index.ts` short and lets reviewers see provider tweaks in isolation.
 */
export function createAuthProviders(): Provider[] {
  return [
    Google({ allowDangerousEmailAccountLinking: true }),
    GitHub({ allowDangerousEmailAccountLinking: true }),
    Nodemailer({
      // Required by Auth.js schema; actual transport is owned by
      // `src/server/mailer.ts` and used via `sendMail` below.
      server: { host: "smtp.gmail.com", port: 465, auth: { user: env.GMAIL_USER, pass: env.GMAIL_APP_PASSWORD } },
      from: `Kharko Dozor <${env.GMAIL_USER}>`,
      async generateVerificationToken() {
        // `randomInt(min, max)` is half-open `[min, max)` — so `max` is
        // `10 ** OTP_LENGTH`, not `10 ** OTP_LENGTH - 1`. Derive both
        // bounds from the single shared constant so the generator
        // follows any length change in `OTP_LENGTH` atomically.
        const min = 10 ** (OTP_LENGTH - 1);
        const max = 10 ** OTP_LENGTH;
        return randomInt(min, max).toString();
      },
      async sendVerificationRequest({ identifier: email, token }) {
        // Rate-limit check (safety net — primary check is in server action).
        const status = await queryOtpRateLimit(email);
        if (!status.allowed) {
          const reason = status.retryAfter ? "cooldown" : "daily_limit";
          log.warn(`auth:otp:${reason}_blocked`, { email });
          throw new Error(status.retryAfter ? "OTP cooldown active" : "Daily OTP limit reached");
        }

        const { count } = await bumpOtpRateLimit(email);
        log.info("auth:otp:sending", { email, newCount: count });

        // Resolve recipient locale before rendering. First-time sign-ups
        // have no User row yet — `resolveLocaleForUser` falls back to
        // `DEFAULT_LOCALE` in that case (and for any stored locale no
        // longer in `LOCALES`).
        const locale = await resolveLocaleForUser(email);
        const t = await getTranslations({ locale, namespace: "emailOtp" });

        // Rethrow on failure — Auth.js surfaces this as a sign-in error
        // so the user sees "couldn't send code, try again", rather than
        // silently leaving them on a spinner.
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
