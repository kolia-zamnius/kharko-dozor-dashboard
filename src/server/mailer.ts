import "server-only";

import { env } from "@/server/env";
import nodemailer, { type Transporter } from "nodemailer";

/**
 * Single shared Nodemailer transporter — every route handler, Auth.js provider, and
 * background job reuses the SMTP connection pool. `service: "gmail"` preset auto-
 * configures host/port/TLS plus Gmail quirks (EHLO, PLAIN encoding); swapping
 * provider means replacing the preset and nothing else here.
 *
 * Gmail requires a 16-char App Password (2FA on the account), not the regular
 * password. SMTP env is optional — self-hosters can deploy OAuth-only.
 */
let cachedTransporter: Transporter | null = null;

/** Throws if SMTP env is unset — callers should have gated on `getEnabledProviders().otp` first. */
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
 * Throws on hard failures — callers decide fatality. Invite emails catch and log
 * (fire-and-forget; the invite row is already persisted). OTP emails rethrow so
 * Auth.js surfaces the error to the user. `from` is fixed at module level — every
 * app email comes from the same branded sender.
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
