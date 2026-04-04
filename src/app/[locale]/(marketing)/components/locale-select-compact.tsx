"use client";

import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useTransition } from "react";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/forms/select";
import { LOCALES, LOCALE_LABELS, type Locale } from "@/i18n/config";
import { usePathname, useRouter } from "@/i18n/navigation";

/**
 * Header-compact language picker for the marketing surface.
 *
 * @remarks
 * Unlike `<LocaleSection>` on `/settings/user`, this variant does NOT
 * persist to `User.locale` — marketing is primarily an anonymous-visitor
 * surface, and authenticated users already have a persisted preference.
 * It only rewrites the URL prefix via typed navigation, letting the
 * next-intl middleware resolve the new locale on the next request.
 *
 * Authenticated visitors who switch locale here get immediately
 * redirected back to their `User.locale` preference by the proxy — a
 * conscious trade-off: this control is for the first-time visitor
 * previewing translations, not for changing settings. The dashboard
 * offers the full persistent picker.
 *
 * @see src/proxy.ts — the locale-mismatch branch that enforces this.
 * @see src/app/[locale]/(dashboard)/settings/user/components/locale-section.tsx
 */
export function LocaleSelectCompact({ currentLocale }: { currentLocale: Locale }) {
  const t = useTranslations("marketing.header");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isNavigating, startTransition] = useTransition();

  function handleChange(value: string) {
    const next = value as Locale;
    if (next === currentLocale) return;
    startTransition(() => {
      const query = searchParams ? Object.fromEntries(searchParams.entries()) : undefined;
      router.replace({ pathname, query }, { locale: next });
    });
  }

  return (
    <Select value={currentLocale} onValueChange={handleChange} disabled={isNavigating}>
      <SelectTrigger size="sm" className="w-auto gap-1.5" aria-label={t("localeAria")}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent align="end">
        {LOCALES.map((locale) => (
          <SelectItem key={locale} value={locale}>
            {LOCALE_LABELS[locale]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
