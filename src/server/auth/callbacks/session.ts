import "server-only";
import { hasLocale } from "next-intl";
import type { NextAuthConfig } from "next-auth";
import { DEFAULT_LOCALE, LOCALES } from "@/i18n/config";
import type { UserId } from "@/types/ids";

// Auth.js types `callbacks` and `callbacks.session` as independently
// optional. The chained `NonNullable<>` strips both layers — see the
// matching block in `jwt.ts` for the same idiom.
type AuthCallbacks = NonNullable<NextAuthConfig["callbacks"]>;
type SessionCallback = NonNullable<AuthCallbacks["session"]>;

/**
 * `session` callback — projects the JWT back onto `session.user` so client
 * code can read it via `useSession()` / `auth()`.
 *
 * Token claims are typed loosely (`unknown`) by Auth.js because they live
 * across the JWT signing boundary. We narrow them to the shapes promised
 * by `src/types/next-auth.d.ts`'s module augmentation. If you add a new
 * field to `Session["user"]`, it must also be written in the `jwt`
 * callback AND mapped here.
 */
export const sessionCallback: SessionCallback = async ({ session, token }) => {
  if (token && session.user) {
    // Trust-boundary cast — the JWT `token.id` is a plain string from
    // Auth.js; branding it here is what lets downstream permission
    // helpers (`requireMember`, `loadTrackedUserDetail`) rely on
    // `UserId` argument types without re-casting at every call site.
    session.user.id = token.id as UserId;
    session.user.email = token.email as string;
    session.user.name = token.name as string;
    session.user.image = token.picture as string;
    session.user.activeOrganizationId = token.activeOrganizationId ?? null;
    // `hasLocale` is a type guard — a stale token (e.g. a locale
    // removed from `LOCALES` between releases) narrows to the default
    // rather than leaking a bogus code out to downstream consumers.
    session.user.locale = hasLocale(LOCALES, token.locale) ? token.locale : DEFAULT_LOCALE;
  }
  return session;
};
