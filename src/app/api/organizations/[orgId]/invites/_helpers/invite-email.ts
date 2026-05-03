import type { getTranslations } from "next-intl/server";

import type { Locale } from "@/i18n/config";
import { env } from "@/server/env";

/** Resolved at the call site so this file stays sync + template-pure (translator-injection pattern). */
type InviteTranslator = Awaited<ReturnType<typeof getTranslations<"emailInvite">>>;

interface InviteEmailArgs {
  locale: Locale;
  orgName: string;
  inviterName: string;
  /** Raw Prisma role — `t.markup` picks the localised label via ICU `select`. */
  role: "OWNER" | "ADMIN" | "VIEWER";
  expiryDays: number;
  t: InviteTranslator;
}

/**
 * Tokenless — links to `/settings/organizations`, not a per-invite URL.
 * Pending invites are looked up by `(email, status)` server-side; a token
 * link would create a second acceptance surface to test.
 *
 * `t.markup` routes ICU `<strong>` tags through the `strong` callback —
 * MessageFormat would otherwise choke on the `<`. Inline dark-mode CSS —
 * email clients usually strip `<style>`, the media query is progressive
 * enhancement.
 */
export function inviteEmailHtml({ locale, orgName, inviterName, role, expiryDays, t }: InviteEmailArgs): string {
  const appUrl = env.AUTH_URL ?? "http://localhost:3000";
  const acceptUrl = `${appUrl}/settings/organizations`;

  const body = t.markup("body", {
    inviterName,
    orgName,
    role,
    strong: (chunks) => `<strong>${chunks}</strong>`,
  });

  return `<!DOCTYPE html>
<html lang="${locale}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
  <style>
    :root { color-scheme: light dark; }
    @media (prefers-color-scheme: dark) {
      .email-bg { background-color: #18181b !important; }
      .card { background-color: #27272a !important; border-color: #3f3f46 !important; }
      .title { color: #fafafa !important; }
      .subtitle { color: #a1a1aa !important; }
      .divider { background-color: #3f3f46 !important; }
      .muted { color: #71717a !important; }
      .brand { color: #fafafa !important; }
      .btn { background-color: #7c3aed !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table role="presentation" class="email-bg" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;">
    <tr><td align="center" style="padding:48px 16px;">
      <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;">

        <tr><td align="center" style="padding-bottom:32px;">
          <span class="brand" style="font-size:16px;font-weight:600;color:#18181b;letter-spacing:0.3px;">${t("brand")}</span>
        </td></tr>

        <tr><td class="card" style="background-color:#ffffff;border-radius:12px;border:1px solid #e4e4e7;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">

            <tr><td style="padding:36px 32px 8px;text-align:center;">
              <p class="title" style="margin:0;font-size:20px;font-weight:600;color:#18181b;">${t("title")}</p>
            </td></tr>

            <tr><td style="padding:4px 32px 24px;text-align:center;">
              <p class="subtitle" style="margin:0;font-size:14px;color:#71717a;line-height:1.5;">
                ${body}
              </p>
            </td></tr>

            <tr><td align="center" style="padding:0 32px 32px;">
              <a href="${acceptUrl}" class="btn" style="display:inline-block;background-color:#7c3aed;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;padding:12px 32px;border-radius:8px;">
                ${t("cta")}
              </a>
            </td></tr>

            <tr><td style="padding:0 32px;">
              <div class="divider" style="height:1px;background-color:#e4e4e7;"></div>
            </td></tr>

            <tr><td style="padding:20px 32px 28px;text-align:center;">
              <p class="muted" style="margin:0;font-size:13px;color:#a1a1aa;line-height:1.5;">
                ${t("footer", { days: expiryDays })}
              </p>
            </td></tr>

          </table>
        </td></tr>

        <tr><td style="padding-top:24px;text-align:center;">
          <p class="muted" style="margin:0;font-size:12px;color:#a1a1aa;">
            ${t("tagline")}
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
