"use client";

import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useTransition } from "react";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/forms/select";
import { LOCALES, LOCALE_LABELS, type Locale } from "@/i18n/config";
import { usePathname, useRouter } from "@/i18n/navigation";

/**
 * URL-only — no `User.locale` write. Authenticated visitors who switch here
 * get redirected back to their persisted preference by `proxy.ts`. This
 * control is for first-time-visitor preview; settings has the persistent picker.
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
