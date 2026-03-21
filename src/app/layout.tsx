import type { Metadata } from "next";
import { getLocale } from "next-intl/server";

import { inter, jetbrainsMono } from "@/app/fonts";
import { cn } from "@/lib/cn";

// Side-effect: registers the server-only `apiFetch` bridge on
// `globalThis` so Server Component prefetch calls resolve to an
// absolute URL + forward the incoming Cookie header. See the module
// docblock for why this has to be imported from a Server Component
// instead of from `fetch.ts` directly.
import "@/api-client/fetch-server-bridge";

import { Providers } from "./_providers/stable";

import "./globals.css";

export const metadata: Metadata = {
  title: "Kharko Dozor",
  description: "Session recording and replay platform",
  icons: {
    icon: { url: "/assets/logo.svg", type: "image/svg+xml" },
  },
};

/**
 * App root layout — owns `<html>` + `<body>` and mounts every
 * **stable** (locale-independent) client provider: TanStack Query,
 * Auth.js session, `next-themes`, sonner.
 *
 * @remarks
 * Deliberately the non-localised root. Switching locale via
 * `router.replace({ pathname }, { locale })` re-renders the `[locale]`
 * segment but leaves this layout (and `<Providers>`) mounted. That
 * keeps `<ThemeProvider>` stable across locale changes — under
 * React 19, `next-themes@0.4.x` renders its pre-hydration theme-init
 * `<script>` through `React.createElement`, and tearing that element
 * down and recreating it trips a dev-overlay "Encountered a script
 * tag while rendering React component" warning. Mounting once, above
 * the locale boundary, avoids the warning entirely.
 *
 * i18n lives one segment down, at `src/app/[locale]/layout.tsx`:
 * `NextIntlClientProvider` + `I18nBridge` wrap there because root
 * layouts don't re-render on client-side navigation, so a
 * `NextIntlClientProvider` at this level would freeze its locale
 * context to whatever value the initial SSR saw. Keeping it inside
 * `[locale]` means every soft navigation re-mounts the i18n subtree
 * with fresh locale and messages.
 *
 * `<html lang>` is seeded server-side from `await getLocale()` so the
 * first paint advertises the correct language. The attribute is then
 * kept in sync on soft navigation by an effect inside `I18nBridge`
 * that writes to `document.documentElement.lang` whenever `useLocale()`
 * reports a change.
 *
 * `suppressHydrationWarning` on `<html>` and `<body>` is required by
 * `next-themes`, which toggles the `class="dark"` attribute
 * pre-hydration.
 *
 * @see src/app/_providers/stable.tsx — stable client providers mounted here.
 * @see src/app/[locale]/layout.tsx — locale validator + i18n providers.
 * @see src/app/_providers/i18n-bridge.tsx — locale-reactive effects.
 * @see src/app/fonts.ts — font definitions + CSS variable bindings.
 * @see src/i18n/request.ts — per-request message + locale resolver.
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
