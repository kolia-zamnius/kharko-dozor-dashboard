import "server-only";
import { resolveLocaleForUser } from "@/i18n/resolve-locale";
import { OTP_LENGTH } from "@/lib/auth/otp.constants";
import { getEnabledProviders } from "@/server/auth/enabled-providers";
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
 * Provider list assembled from env. `allowDangerousEmailAccountLinking: true`
 * on Google + GitHub so the same email can sign in via either OAuth or OTP.
 * Nodemailer's `server` is a placeholder — real transport lives in
 * {@link src/server/mailer.ts}; `sendVerificationRequest` calls `sendMail`.
 * Passkey always added (it's an add-on registered from Settings, not an
 * account-creation path). Boot-time refine in `env.ts` guarantees at least one
 * of Google / GitHub / OTP is configured.
 */
export function createAuthProviders(): Provider[] {
  const enabled = getEnabledProviders();
  const providers: Provider[] = [];

  if (enabled.google) {
    providers.push(Google({ allowDangerousEmailAccountLinking: true }));
  }
  if (enabled.github) {
    providers.push(GitHub({ allowDangerousEmailAccountLinking: true }));
  }
  if (enabled.otp) {
    providers.push(
      Nodemailer({
        // Required by Auth.js schema; `sendVerificationRequest` overrides the
        // actual send. Non-null env reads are sound — `enabled.otp` requires both.
        server: { host: "smtp.gmail.com", port: 465, auth: { user: env.GMAIL_USER!, pass: env.GMAIL_APP_PASSWORD! } },
        from: `Dozor <${env.GMAIL_USER!}>`,
        async generateVerificationToken() {
          // `randomInt(min, max)` is half-open `[min, max)` — derive both bounds
          // from `OTP_LENGTH` so the generator follows any length change atomically.
          const min = 10 ** (OTP_LENGTH - 1);
          const max = 10 ** OTP_LENGTH;
          return randomInt(min, max).toString();
        },
        async sendVerificationRequest({ identifier: email, token }) {
          // Safety net — primary check runs in the sign-in server action.
          const status = await queryOtpRateLimit(email);
          if (!status.allowed) {
            const reason = status.retryAfter ? "cooldown" : "daily_limit";
            log.warn(`auth:otp:${reason}_blocked`, { email });
            throw new Error(status.retryAfter ? "OTP cooldown active" : "Daily OTP limit reached");
          }

          const { count } = await bumpOtpRateLimit(email);
          log.info("auth:otp:sending", { email, newCount: count });

          // First-time sign-ups have no User row yet — `resolveLocaleForUser`
          // falls back to `DEFAULT_LOCALE` (also for stored locales no longer in `LOCALES`).
          const locale = await resolveLocaleForUser(email);
          const t = await getTranslations({ locale, namespace: "emailOtp" });

          // Rethrow on send failure so Auth.js surfaces a sign-in error
          // ("couldn't send code, try again") instead of leaving the user on a spinner.
          await sendMail({
            to: email,
            subject: t("subject", { token }),
            html: otpEmailHtml(token, locale, t),
          });
        },
      }),
    );
  }

  providers.push(Passkey);

  return providers;
}
