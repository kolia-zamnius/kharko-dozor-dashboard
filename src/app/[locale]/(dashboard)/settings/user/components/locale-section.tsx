"use client";

import { useTranslations } from "next-intl";
import { useSession } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { useTransition } from "react";

import { useUpdateLocaleMutation } from "@/api-client/user/mutations";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/layout/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/forms/select";
import { DEFAULT_LOCALE, LOCALE_LABELS, LOCALES, type Locale } from "@/i18n/config";
import { usePathname, useRouter } from "@/i18n/navigation";

/**
 * Three-step chain — must settle atomically or the picker flashes a locale
 * the tree hasn't switched to: PATCH → `session.update({})` (JWT refresh) →
 * `router.replace({pathname}, {locale})`. `useTransition` keeps the Select
 * disabled until the navigation commits.
 */
export function LocaleSection() {
  const t = useTranslations("settings.user.locale");
  const { data: session, update } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const mutation = useUpdateLocaleMutation();
  const [isNavigating, startTransition] = useTransition();

  const current = (session?.user?.locale ?? DEFAULT_LOCALE) as Locale;
  const busy = mutation.isPending || isNavigating;

  function handleChange(value: string) {
    const next = value as Locale;
    if (next === current) return;
    mutation.mutate(
      { locale: next },
      {
        onSuccess: () => {
          startTransition(async () => {
            await update({});
            // Object form preserves `?query` across the swap — the string form drops it.
            const query = searchParams ? Object.fromEntries(searchParams.entries()) : undefined;
            router.replace({ pathname, query }, { locale: next });
          });
        },
      },
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent>
        <Select value={current} onValueChange={handleChange} disabled={busy}>
          <SelectTrigger className="w-full sm:w-64" aria-label={t("selectAria")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {LOCALES.map((locale) => (
              <SelectItem key={locale} value={locale}>
                {LOCALE_LABELS[locale]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardContent>
    </Card>
  );
}
