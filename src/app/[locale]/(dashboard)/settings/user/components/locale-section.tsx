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
 * Language picker on `/settings/user`.
 *
 * @remarks
 * The happy path is a three-step chain that has to settle atomically or
 * the UI flashes inconsistent state:
 *
 *   1. `PATCH /api/user/locale` — persist the preference (mutation).
 *   2. `session.update({})` — force a JWT refresh so `session.user.locale`
 *      tracks the DB. The `jwt` callback re-reads the user row; the
 *      `session` callback narrows it to the session via `hasLocale`.
 *   3. `router.replace(pathname, { locale })` — the typed navigation
 *      helper re-writes the URL prefix (`/en/...` → `/uk/...`) and
 *      remounts the tree under `NextIntlClientProvider`, so every
 *      `useTranslations()` consumer picks up the new messages.
 *
 * Wrapping `session.update` + `router.replace` in `useTransition`
 * keeps the Select disabled through the transition; the select's
 * controlled `value` stays on the previous locale until the navigation
 * commits, so there's no flicker where the picker advertises a locale
 * the tree hasn't switched to yet.
 *
 * @see src/app/api/user/locale/route.ts — server counterpart.
 * @see src/api-client/user/mutations.ts::useUpdateLocaleMutation — write.
 * @see src/server/auth/callbacks/jwt.ts — re-reads `locale` on refresh.
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
            // Preserve `?query` across the locale swap — `router.replace`
            // with the string form drops it. Object form threads the
            // current searchParams through next-intl's typed navigation
            // so switching locale on `/replays?range=7d&search=foo`
            // lands on `/uk/replays?range=7d&search=foo` instead of
            // `/uk/replays`. Hash isn't in searchParams (client-only)
            // but the browser retains it across `router.replace` by
            // default, matching the proxy-side redirect behaviour.
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
