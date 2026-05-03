import "server-only";
import { hasLocale } from "next-intl";
import type { NextAuthConfig } from "next-auth";
import { DEFAULT_LOCALE, LOCALES } from "@/i18n/config";
import type { UserId } from "@/types/ids";

type AuthCallbacks = NonNullable<NextAuthConfig["callbacks"]>;
type SessionCallback = NonNullable<AuthCallbacks["session"]>;

/**
 * Projects token claims onto `session.user`. The `as UserId` cast here is the
 * trust boundary — once branded, downstream permission helpers (`requireMember`,
 * loaders that take `UserId`) don't re-cast at each call site.
 */
export const sessionCallback: SessionCallback = async ({ session, token }) => {
  if (token && session.user) {
    session.user.id = token.id as UserId;
    session.user.email = token.email as string;
    session.user.name = token.name as string;
    session.user.image = token.picture as string;
    session.user.activeOrganizationId = token.activeOrganizationId ?? null;
    // `hasLocale` narrows: if `LOCALES` shed a code between releases, a stale
    // token falls back to default rather than leaking a bogus locale downstream.
    session.user.locale = hasLocale(LOCALES, token.locale) ? token.locale : DEFAULT_LOCALE;
  }
  return session;
};
