"use client";

import { useLocale, useMessages, useTranslations } from "next-intl";
import { useEffect } from "react";
import { z } from "zod";

import { setLocaleMessages } from "@/i18n/imperative-translator";
import { buildZodErrorMap } from "@/lib/zod-error-map";

/**
 * Locale-reactive — mounted inside `[locale]/layout.tsx` so every
 * `router.replace({ locale })` re-runs the three effects.
 *
 *   1. Imperative translator — `lib/query-client.ts` reads `mutation.meta.{successKey,errorKey}`
 *      from an outside-React handler; this pushes locale + messages into that bridge.
 *   2. Browser-side Zod error map — single `z.config({ customError })` so every
 *      `schema.parse()` (notably `react-hook-form` + `zodResolver`) is localised
 *      without per-form wiring. Server never mutates `z.config` — `withAuth`/
 *      `withPublicKey` rebuild per request to avoid concurrent-locale races.
 *   3. `<html lang>` DOM sync — root layout seeds it from SSR but doesn't
 *      re-render on client nav, so the attribute would freeze without this.
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
