import "server-only";

import type { getTranslations } from "next-intl/server";

import type { Locale } from "@/i18n/config";

type OtpTranslator = Awaited<ReturnType<typeof getTranslations<"emailOtp">>>;

/**
 * OTP verification email. Light-mode styles are inline `style=""` because email
 * clients strip `<style>` blocks inconsistently; the `<style>` block carries only
 * `@media (prefers-color-scheme: dark)` overrides — those clients also honor
 * `!important` class selectors, which is what makes dark mode work without inline.
 * `t` is injected because this runs outside the React tree.
 */
export function otpEmailHtml(token: string, locale: Locale, t: OtpTranslator): string {
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
      .code-box { background-color: #3f3f46 !important; border-color: #52525b !important; }
      .code { color: #a78bfa !important; }
      .divider { background-color: #3f3f46 !important; }
      .muted { color: #71717a !important; }
      .brand { color: #fafafa !important; }
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
              <p class="subtitle" style="margin:0;font-size:14px;color:#71717a;">${t("subtitle")}</p>
            </td></tr>

            <tr><td align="center" style="padding:0 32px 32px;">
              <div class="code-box" style="background-color:#f4f4f5;border-radius:8px;border:1px solid #e4e4e7;padding:14px 28px;">
                <span class="code" style="font-size:32px;font-weight:700;color:#7c3aed;font-family:'SF Mono',SFMono-Regular,Consolas,'Liberation Mono',Menlo,monospace;letter-spacing:0.4em;">${token}</span>
              </div>
            </td></tr>

            <tr><td style="padding:0 32px;">
              <div class="divider" style="height:1px;background-color:#e4e4e7;"></div>
            </td></tr>

            <tr><td style="padding:20px 32px 28px;text-align:center;">
              <p class="muted" style="margin:0;font-size:13px;color:#a1a1aa;line-height:1.5;">
                ${t("footer")}
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
