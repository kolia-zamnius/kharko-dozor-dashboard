import "server-only";

import { env } from "@/server/env";
import nodemailer, { type Transporter } from "nodemailer";

/**
 * Single shared Nodemailer transport for the whole app.
 *
 * Lazy-instantiated on first call and memoized on the module scope so
 * every route handler, every Auth.js provider, and every future
 * background job reuses the same SMTP connection pool. Creating a
 * transporter per request would thrash Gmail's per-connection limits
 * and tank delivery latency.
 *
 * Development note: Gmail's SMTP endpoint requires an **App Password**
 * (16-character code from a Google account with 2FA enabled), NOT the
 * regular account password. See the project README for the exact
 * "Generate app password" steps.
 *
 * Why `service: "gmail"` instead of explicit host/port: Nodemailer's
 * preset maps to `smtp.gmail.com:465` with TLS automatically, and it
 * silently picks up Gmail-specific quirks (correct EHLO name, proper
 * PLAIN auth encoding) that we'd otherwise have to wire by hand. If we
 * ever move off Gmail, swap the preset for a full `host/port/secure`
 * object and nothing else in this module changes.
 */
let cachedTransporter: Transporter | null = null;

/**
 * SMTP env is optional — a self-hoster can deploy with OAuth-only
 * sign-in and no invite emails. Callers reaching `sendMail` without
 * SMTP configured indicate a code path that didn't gate on
 * `getEnabledProviders().otp` (or its invite-equivalent flag); throw a
 * clear error rather than letting Nodemailer fail with an opaque "auth
 * required" message.
 */
function getTransporter(): Transporter {
  if (cachedTransporter) return cachedTransporter;

  if (!env.GMAIL_USER || !env.GMAIL_APP_PASSWORD) {
    throw new Error(
      "Email transport not configured: GMAIL_USER + GMAIL_APP_PASSWORD env vars are required to send mail. If this fired from a sign-in / invite flow, that flow should have been gated on the env presence.",
    );
  }

  cachedTransporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: env.GMAIL_USER,
      pass: env.GMAIL_APP_PASSWORD,
    },
  });

  return cachedTransporter;
}

export type SendMailInput = {
  to: string;
  subject: string;
  html: string;
};

/**
 * Send a transactional email. Throws on hard failures (SMTP auth,
 * network error, relay rejection) so the caller can decide whether
 * the failure is fatal — invite emails catch and log (fire-and-forget
 * because the invite row is already persisted), while OTP emails
 * rethrow so Auth.js surfaces the error to the user.
 *
 * The `from` address is fixed at module level — every app email comes
 * from the same branded sender, so there's no reason to thread it
 * through call sites.
 */
export async function sendMail({ to, subject, html }: SendMailInput): Promise<void> {
  const transporter = getTransporter();

  await transporter.sendMail({
    from: `Dozor <${env.GMAIL_USER!}>`,
    to,
    subject,
    html,
  });
}
