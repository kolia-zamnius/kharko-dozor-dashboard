import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { cookies, headers } from "next/headers";

import { inter, jetbrainsMono } from "@/app/fonts";
import { Button } from "@/components/ui/primitives/button";
import { DEFAULT_LOCALE, LOCALES, type Locale } from "@/i18n/config";
import { cn } from "@/lib/cn";

import "./globals.css";

/**
 * Next.js 16's `global-not-found` (gated by `experimental.globalNotFound`)
 * fires when a layout itself bails — e.g. `[locale]/layout.tsx` rejects
 * `"404"` as an invalid locale, so per-segment `not-found.tsx` can't render
 * because its own layout chain already failed. Without this file the user
 * sees Next.js's built-in default page.
 *
 * Bypasses every layout above, so this file owns its own `<html>`/`<body>`,
 * imports `globals.css` directly, wires the font CSS vars inline, and
 * resolves locale itself (no `NextIntlClientProvider` runs here).
 *
 * Theme class hardcoded to `dark` — `ThemeProvider` never runs, so
 * `next-themes` can't inject its FOUC-prevention script. Pinning matches
 * `defaultTheme: "dark"`; users with a non-default stored preference see a
 * mismatch only on this edge page.
 *
 * Hard nav (`<a href>`) on the CTA — middleware re-runs and proxy.ts
 * redirects anon→`/sign-in?callbackUrl=/users`, authed→preferred locale's
 * `/users`. Soft nav can leave the 404 UI mounted after the router advances.
 */

/**
 * Cookie → Accept-Language primary subtag → DEFAULT_LOCALE. Sibling
 * `resolveLocaleForUser` reads Prisma for a known recipient; this one reads
 * anonymous request headers.
 */
async function detectLocale(): Promise<Locale> {
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get("NEXT_LOCALE")?.value;
  if (hasLocale(LOCALES, cookieLocale)) return cookieLocale;

  const requestHeaders = await headers();
  const acceptLanguage = requestHeaders.get("accept-language");
  if (acceptLanguage) {
    // `uk-UA,uk;q=0.9,en;q=0.8` → primary subtag only. App doesn't
    // discriminate regional variants, so `uk-UA` and `uk-CA` both hit `uk`.
    for (const tag of acceptLanguage.split(",")) {
      const primary = tag.trim().split(";")[0]?.split("-")[0]?.toLowerCase();
      if (hasLocale(LOCALES, primary)) return primary;
    }
  }

  return DEFAULT_LOCALE;
}

export async function generateMetadata(): Promise<Metadata> {
  const locale = await detectLocale();
  const t = await getTranslations({ locale, namespace: "common.notFound" });
  return {
    title: `${t("title")} — Dozor`,
  };
}

export default async function GlobalNotFound() {
  const locale = await detectLocale();
  const t = await getTranslations({ locale, namespace: "common.notFound" });

  return (
    <html lang={locale} className={cn(inter.variable, jetbrainsMono.variable, "dark", "font-sans")}>
      <body className="bg-background text-foreground min-h-dvh">
        <div className="mx-auto flex max-w-md flex-col items-center justify-center py-24 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="text-muted-foreground mt-2 text-sm">{t("description")}</p>
          <Button asChild className="mt-6">
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- hard nav so proxy.ts re-runs (see file JSDoc) */}
            <a href="/replays">{t("goToDashboard")}</a>
          </Button>
        </div>
      </body>
    </html>
  );
}
