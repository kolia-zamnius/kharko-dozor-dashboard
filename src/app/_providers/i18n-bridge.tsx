"use client";

import { useLocale, useMessages, useTranslations } from "next-intl";
import { useEffect } from "react";
import { z } from "zod";

import { setLocaleMessages } from "@/i18n/imperative-translator";
import { buildZodErrorMap } from "@/lib/zod-error-map";

/**
 * Locale-reactive i18n wiring. Paired with the sibling
 * {@link ./stable.tsx}; mounted one segment **inside** the root
 * providers at `src/app/[locale]/layout.tsx` (below
 * `NextIntlClientProvider`) so every client-side locale change — soft
 * navigation via typed `router.replace({ locale })` — re-runs the
 * three effects below with the fresh locale.
 *
 * @remarks
 * The bridge owns three concerns that all depend on a live locale:
 *
 *   1. **Imperative translator for outside-React consumers.**
 *      `lib/query-client.ts::MutationCache.on{Success,Error}` resolves
 *      `mutation.meta.{successKey,errorKey}` through a module-scoped
 *      translator. The effect pushes the active locale + messages into
 *      that bridge so toasts fire in the right language even though the
 *      handler lives outside the React tree.
 *
 *   2. **Global Zod error map.** `z.config({ customError })` installs
 *      a single browser-side error map so every `schema.parse()` call
 *      (notably `react-hook-form` + `zodResolver`) produces localised
 *      messages without per-form wiring. The server never mutates
 *      `z.config` — it rebuilds the map per-request inside
 *      `withAuth` / `withPublicKey`, so concurrent requests with
 *      different locales don't race.
 *
 *   3. **`<html lang>` DOM sync.** The root layout at `src/app/layout.tsx`
 *      seeds the attribute server-side from `await getLocale()`, but
 *      root layouts don't re-render on client-side navigation, so the
 *      attribute would otherwise stay frozen at the initial SSR locale.
 *      The effect updates it from whatever `useLocale()` reports
 *      — which is always the current URL-resolved locale because
 *      `NextIntlClientProvider` is mounted inside this `[locale]`
 *      segment and remounts on every change.
 *
 * **Why this file is split from `stable.tsx`.** See
 * {@link ./stable.tsx} for the full rationale (React 19 +
 * `next-themes@0.4.x` script-warning interaction) and the conditions
 * under which the split is safe to undo.
 *
 * @see ./stable.tsx — stable-across-locale providers paired with this file.
 * @see src/app/[locale]/layout.tsx — wraps children with
 *   `NextIntlClientProvider` + `I18nBridge`.
 */
export function I18nBridge({ children }: { children: React.ReactNode }) {
  const locale = useLocale();
  const messages = useMessages();
  const tValidation = useTranslations("errors.validation");

  useEffect(() => {
    setLocaleMessages(locale, messages);
  }, [locale, messages]);

  useEffect(() => {
    z.config({ customError: buildZodErrorMap(tValidation) });
  }, [tValidation]);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  return <>{children}</>;
}
