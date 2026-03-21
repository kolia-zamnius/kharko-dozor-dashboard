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
 * Global 404 for URLs that don't match any route in the app.
 *
 * @remarks
 * Next.js 16 introduces `global-not-found.tsx` (gated behind
 * `experimental.globalNotFound` in `next.config.ts`) as the stable
 * answer to a long-standing gap: when `notFound()` fires from a
 * layout — for example, `[locale]/layout.tsx` rejecting `"404"` as
 * an invalid locale — the per-segment `not-found.tsx` can't render
 * because its own layout chain already bailed. Without this file
 * the user would see Next.js's built-in default 404 page instead of
 * anything matching the app's visual language.
 *
 * **Contract:** this file bypasses every `layout.tsx` above it, so
 * it must:
 *   - Declare its own `<html>` + `<body>` wrapper.
 *   - Import `./globals.css` directly (no layout means no global
 *     stylesheet injection chain).
 *   - Wire up the font CSS variables inline (same shape as
 *     `[locale]/layout.tsx`, otherwise Tailwind's `font-sans` /
 *     `font-mono` utilities would render with the system default).
 *   - Resolve locale on its own — `NextIntlClientProvider` doesn't
 *     run here, so there's no `useTranslations()`. Server-side
 *     `getTranslations({ locale, namespace })` works standalone as
 *     long as we hand it an explicit locale.
 *
 * **Locale detection ({@link detectLocale}).** Priority chain:
 *
 *   1. `NEXT_LOCALE` cookie — the next-intl-standard cookie a user
 *      picks up after their first visit to any `[locale]/…` route
 *      or via the `<LocaleSection>` switch. Honouring it means a
 *      Ukrainian user who stumbles onto a 404 sees Ukrainian copy
 *      even if their browser's `Accept-Language` says otherwise.
 *   2. `Accept-Language` header — browser's language preference,
 *      parsed down to the primary subtag and narrowed against
 *      `LOCALES`. Covers first-time visitors.
 *   3. `DEFAULT_LOCALE` — anything unrecognised lands here.
 *
 * The button uses a plain `<a href>` (not `next/link`) so the click
 * triggers a hard navigation — full page reload, middleware re-runs.
 * Soft navigation from `next/link` can leave the 404 UI mounted
 * after the router advances; hard nav is the cheap, reliable fix
 * for an escape-hatch button that has to work no matter how broken
 * the route state is. `proxy.ts` then swings anonymous visitors to
 * `/sign-in` (with `callbackUrl=/users`) and authed users directly
 * to their preferred locale's `/users`.
 *
 * **Theme class is hardcoded to `dark`.** The `ThemeProvider` in
 * `src/app/_providers/stable.tsx` never runs here (we bypassed the layout
 * chain), so `next-themes` has no chance to inject its inline
 * "read localStorage and flip the class" script. Without it the
 * page would render with the light-theme fallback defined at
 * `:root` in `globals.css`. Pinning `dark` on the `<html>` tag
 * matches the app-wide `defaultTheme: "dark"` and keeps the 404
 * visually consistent with every other page. If the user stored a
 * non-default preference, they'll see it mismatch only on this
 * edge-case page — acceptable tradeoff vs a flash of light theme.
 *
 * Route-specific 404s (`users/[userId]/not-found.tsx` for a deleted
 * tracked user, `[locale]/not-found.tsx` for unknown paths inside a
 * valid locale) still take precedence via the usual `not-found.tsx`
 * bubbling rules — this file only fires when neither can run.
 *
 * @see src/app/[locale]/not-found.tsx — scoped fallback when the
 *   parent layout chain is intact.
 */

/**
 * Detect a supported locale for an anonymous request that can't go
 * through the normal `getRequestConfig` → `requestLocale` pipeline
 * (because the URL didn't match `[locale]/` at all). Reads cookie,
 * then header, then falls back to the default.
 *
 * @remarks
 * Kept inline in this file because `global-not-found.tsx` is the
 * only consumer today — if a second standalone-server surface
 * (e.g. a public docs root) starts needing the same detection, this
 * lifts to `src/i18n/` per the rule-of-three. The email-side
 * `resolveLocaleForUser` is a sibling but distinct concern: that
 * one hits Prisma for a known recipient, this one reads anonymous
 * request headers.
 */
async function detectLocale(): Promise<Locale> {
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get("NEXT_LOCALE")?.value;
  if (hasLocale(LOCALES, cookieLocale)) return cookieLocale;

  const requestHeaders = await headers();
  const acceptLanguage = requestHeaders.get("accept-language");
  if (acceptLanguage) {
    // Accept-Language tags look like `uk-UA,uk;q=0.9,en-US;q=0.8,en;q=0.7`.
    // Strip q-values, lowercase, and take only the primary subtag
    // (`uk-UA` → `uk`) before the `LOCALES` check — the app doesn't
    // discriminate between regional variants so a `uk-UA` browser
    // matches the `uk` bundle just like a `uk-CA` browser would.
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
    title: `${t("title")} — Kharko Dozor`,
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
            {/* Plain `<a href>` forces a hard navigation —
                middleware re-runs, 404 UI unmounts cleanly.
                `proxy.ts` handles auth (anon → redirect to sign-in
                with `callbackUrl=/users`, signed-in → dashboard)
                and swaps to the visitor's preferred locale in the
                process. */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- intentional hard nav (see JSDoc above) */}
            <a href="/users">{t("goToDashboard")}</a>
          </Button>
        </div>
      </body>
    </html>
  );
}
