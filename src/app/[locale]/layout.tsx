import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";

import { routing } from "@/i18n/routing";

import { I18nBridge } from "../_providers/i18n-bridge";

/**
 * Locale segment layout — validates the URL locale, then wraps
 * children in the locale-reactive i18n providers.
 *
 * @remarks
 * `NextIntlClientProvider` sits here (not in the non-localised root
 * layout) for a concrete reason: root layouts don't re-render on
 * client-side navigation between sibling segments, so mounting the
 * provider at the root would freeze its locale/messages to the initial
 * SSR value. Placing it inside `[locale]` means every soft navigation
 * (`/en` ↔ `/uk` ↔ `/de`) remounts the subtree with fresh context —
 * `useLocale()` / `useTranslations()` downstream always report the
 * current URL locale.
 *
 * The structural HTML shell (`<html>`, `<body>`, fonts, global CSS)
 * and every **stable** client provider (TanStack Query, Auth.js
 * session, `next-themes`, sonner) live in `src/app/layout.tsx`. Keeping
 * those above this segment preserves their mount across locale
 * navigations — required for `ThemeProvider`, whose pre-hydration
 * script would otherwise trip a React 19 "Encountered a script tag
 * while rendering React component" warning on every locale change.
 *
 * `generateStaticParams` stays in this file because this is the
 * owner of the `[locale]` dynamic segment — Next.js enumerates param
 * values from the closest layout/page that declares them.
 *
 * @see src/app/layout.tsx — root layout that owns html/body + stable providers.
 * @see src/app/_providers/i18n-bridge.tsx — locale-reactive effects (imperative
 *   translator wiring, Zod error-map, `<html lang>` sync).
 * @see src/i18n/routing.ts — locale registry consumed for narrowing.
 */
export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  return (
    <NextIntlClientProvider>
      <I18nBridge>{children}</I18nBridge>
    </NextIntlClientProvider>
  );
}
