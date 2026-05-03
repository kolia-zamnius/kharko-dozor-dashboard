import { ImageResponse } from "next/og";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";

import { DEFAULT_LOCALE, LOCALES } from "@/i18n/config";

export const alt = "Dozor — Open-source session replay";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * Hardcoded hex (not `var(--color-*)`) — `ImageResponse` runs outside the DOM
 * so Tailwind/CSS vars don't resolve. Only inline `style` + a Tailwind class
 * subset is supported.
 */
export default async function OpengraphImage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  const locale = hasLocale(LOCALES, raw) ? raw : DEFAULT_LOCALE;
  const t = await getTranslations({ locale, namespace: "marketing" });

  return new ImageResponse(
    <div
      style={{
        height: "100%",
        width: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: "80px",
        background: "#0a0a0a",
        color: "#fafafa",
        fontFamily: "sans-serif",
      }}
    >
      <div
        style={{
          display: "inline-flex",
          alignSelf: "flex-start",
          padding: "8px 16px",
          borderRadius: "999px",
          border: "1px solid #52525b",
          color: "#a1a1aa",
          fontSize: "22px",
          marginBottom: "32px",
        }}
      >
        {t("hero.eyebrow")}
      </div>
      <div
        style={{
          fontSize: "76px",
          fontWeight: 600,
          lineHeight: 1.05,
          letterSpacing: "-0.025em",
          marginBottom: "24px",
          display: "flex",
        }}
      >
        {t("hero.headline")}
      </div>
      <div
        style={{
          fontSize: "30px",
          color: "#a1a1aa",
          lineHeight: 1.4,
          display: "flex",
        }}
      >
        Dozor
      </div>
    </div>,
    size,
  );
}
