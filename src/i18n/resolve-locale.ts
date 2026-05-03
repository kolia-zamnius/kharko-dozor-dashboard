import "server-only";

import { hasLocale } from "next-intl";

import { prisma } from "@/server/db/client";

import type { Locale } from "./config";
import { DEFAULT_LOCALE, LOCALES } from "./config";

/**
 * For email builders below the React tree (OTP send, invite send) — they can't
 * read `getRequestConfig`, so they call this before handing `locale` to
 * `getTranslations({ locale, … })`. Falls back to default for: first-time OTP (no
 * `User` row yet), invite to a new recipient (inviter's locale isn't borrowed —
 * guessing wrong is worse than a neutral default), and legacy stored values whose
 * locale has since been removed from `LOCALES`. Never blocks the send — degrade
 * to English is the quiet correct behaviour.
 */
export async function resolveLocaleForUser(email: string): Promise<Locale> {
  const user = await prisma.user.findUnique({
    where: { email },
    select: { locale: true },
  });
  const stored = user?.locale;
  return hasLocale(LOCALES, stored) ? stored : DEFAULT_LOCALE;
}
