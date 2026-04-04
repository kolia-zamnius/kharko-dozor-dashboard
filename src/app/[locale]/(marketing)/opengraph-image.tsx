import { ImageResponse } from "next/og";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";

import { DEFAULT_LOCALE, LOCALES } from "@/i18n/config";

export const alt = "Kharko Dozor — Open-source session replay";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * Dynamic OpenGraph image for the marketing landing — rendered per
 * locale by Next.js's `opengraph-image.tsx` convention.
 *
 * @remarks
 * Rendered at request time via `next/og`'s `ImageResponse` on the
 * Node runtime (no `export const runtime = "edge"` — the default
 * runtime works fine and keeps this aligned with the rest of the
 * Server Component graph that reads `next-intl` + env on the server).
 * Shares stay in sync with the copy automatically — adjusting the
 * visual or headline is a single-file edit; there's no PNG asset to
 * regenerate.
 *
 * The visual echoes the landing hero: near-black background, muted
 * eyebrow badge, large sans-serif headline, subdued sub-line. Colours
 * are hardcoded hex (not `var(--color-*)`) because `ImageResponse`
 * runs outside the DOM so Tailwind / CSS variables don't resolve.
 * Only inline `style` plus a subset of Tailwind class names are
 * supported; advanced selectors are not.
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
        Kharko Dozor
      </div>
    </div>,
    size,
  );
}
