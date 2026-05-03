import type { Metadata } from "next";
import { getLocale } from "next-intl/server";

import { inter, jetbrainsMono } from "@/app/fonts";
import { cn } from "@/lib/cn";

// Side-effect — registers the server-only `apiFetch` bridge on `globalThis`.
// Imported from a Server Component (not `fetch.ts`) to keep `next/headers`
// out of the Client Component SSR graph.
import "@/api-client/fetch-server-bridge";

import { Providers } from "./_providers/stable";

import "./globals.css";

export const metadata: Metadata = {
  title: "Dozor",
  description: "Session recording and replay platform",
  icons: {
    icon: { url: "/assets/logo.svg", type: "image/svg+xml" },
  },
};

/**
 * Non-localised root — locale-independent providers mount here so they stay
 * stable across `router.replace({pathname}, {locale})` swaps. Under React 19,
 * `next-themes@0.4.x` renders its pre-hydration init `<script>` through
 * `React.createElement` — tearing that down on locale change trips the
 * "Encountered a script tag" dev-overlay warning. Mounting once above the
 * `[locale]` boundary avoids it.
 *
 * i18n lives one segment down so soft navigation actually re-mounts with
 * fresh locale + messages. `<html lang>` is seeded from `getLocale()` for the
 * first paint and kept in sync by `I18nBridge` on subsequent navigation.
 *
 * `suppressHydrationWarning` on html/body — `next-themes` toggles the `dark`
 * class pre-hydration.
 */
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();

  return (
    <html lang={locale} className={cn(inter.variable, jetbrainsMono.variable, "font-sans")} suppressHydrationWarning>
      <body className="min-h-dvh" suppressHydrationWarning>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
