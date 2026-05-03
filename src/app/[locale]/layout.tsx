import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";

import { routing } from "@/i18n/routing";

import { I18nBridge } from "../_providers/i18n-bridge";

/**
 * `NextIntlClientProvider` sits here (not the root) — root layouts don't
 * re-render on sibling-segment navigation, so a root mount would freeze locale
 * to the initial SSR value. Mounting inside `[locale]` remounts the subtree
 * on every soft nav.
 *
 * `generateStaticParams` belongs here — Next.js enumerates dynamic-segment
 * params from the closest layout/page that declares them.
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
