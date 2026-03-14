import "server-only";

import { hasLocale } from "next-intl";

import { prisma } from "@/server/db/client";

import type { Locale } from "./config";
import { DEFAULT_LOCALE, LOCALES } from "./config";

/**
 * Resolves the preferred locale for an email recipient who is outside
 * any React request context — the OTP email builder in
 * `server/auth/otp/` and the invite email builder in
 * `app/api/organizations/[orgId]/invites/_helpers/` both sit below the
 * React tree and can't read `getRequestConfig`, so they call this
 * helper before handing `locale` to `getTranslations({ locale, … })`.
 *
 * @remarks
 * Falls back to {@link DEFAULT_LOCALE} in three scenarios the caller
 * already has to tolerate:
 *
 *  - **First-time OTP sign-up** — no `User` row exists yet for this
 *    email address. A future-created user will set their preference
 *    from the UI.
 *  - **Invite to a new recipient** — the invitee hasn't registered.
 *    Inviter's locale is deliberately NOT used here: the invitee may
 *    not share it, and guessing wrong is a worse UX than a neutral
 *    default.
 *  - **Legacy persisted value** — a row whose stored `locale` was
 *    valid at write time but has since been removed from
 *    {@link LOCALES} in a later release. `hasLocale` narrows it back
 *    to the default rather than handing a bogus code to
 *    `getTranslations`, which would throw a `MODULE_NOT_FOUND` at the
 *    `import()` call in `request.ts`.
 *
 * We never let a locale-lookup failure block an email send — every
 * thrown path in the caller is a noisy incident, and "degrade to
 * English" is the quiet correct behaviour.
 */
export async function resolveLocaleForUser(email: string): Promise<Locale> {
  const user = await prisma.user.findUnique({
    where: { email },
    select: { locale: true },
  });
  const stored = user?.locale;
  return hasLocale(LOCALES, stored) ? stored : DEFAULT_LOCALE;
}
