import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";

import { routing } from "./routing";

/**
 * Per-request message loader — invoked by next-intl once per incoming
 * request to resolve the active locale and hand every namespace's
 * JSON dictionary to the React tree.
 *
 * @remarks
 * `getRequestConfig` is the **only** place server-side translations
 * are sourced from. Both `getTranslations()` in server components and
 * `<NextIntlClientProvider>` in the root layout read from the object
 * returned here, so this file is effectively the i18n composition
 * root on the server side.
 *
 * **Namespace aggregation is intentionally flat.** All ten namespaces
 * load on every request regardless of the route — next-intl's server
 * API does not support per-layout message scoping, and the total
 * payload is ~12 KB per locale (one locale at a time is ever resolved,
 * so the client bundle carries only the active language). Splitting
 * by page or feature would trade that flat cost for indirection
 * without a real bundle win.
 *
 * **`hasLocale` guards the narrowing.** The `requestLocale` promise
 * can resolve to `undefined` (no prefix → default locale) or to a
 * string we don't recognise (stale bookmark → unreachable locale).
 * `hasLocale(routing.locales, requested)` collapses both cases to
 * `routing.defaultLocale` without ever handing an unknown code to
 * `import()`, which would 500 the request with an opaque MODULE_NOT_FOUND.
 *
 * @see src/i18n/routing.ts — locale registry consumed here
 * @see src/types/next-intl.d.ts — message-shape augmentation for type-safe keys
 */
export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;

  return {
    locale,
    messages: {
      common: (await import(`./messages/${locale}/common.json`)).default,
      errors: (await import(`./messages/${locale}/errors.json`)).default,
      components: (await import(`./messages/${locale}/components.json`)).default,
      shell: (await import(`./messages/${locale}/shell.json`)).default,
      auth: (await import(`./messages/${locale}/auth.json`)).default,
      users: (await import(`./messages/${locale}/users.json`)).default,
      replays: (await import(`./messages/${locale}/replays.json`)).default,
      settings: (await import(`./messages/${locale}/settings.json`)).default,
      marketing: (await import(`./messages/${locale}/marketing.json`)).default,
      emailOtp: (await import(`./messages/${locale}/email-otp.json`)).default,
      emailInvite: (await import(`./messages/${locale}/email-invite.json`)).default,
    },
  };
});
