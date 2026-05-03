import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";

import { routing } from "./routing";

/**
 * i18n composition root on the server — the only place translations are sourced
 * for both `getTranslations()` (server components) and `<NextIntlClientProvider>`
 * (root layout). All 10 namespaces flat-load per request (~12KB per locale; only
 * the active language ships to the client, so splitting wouldn't save bundle).
 * `hasLocale` narrows undefined or unknown values to the default — without it a
 * stale URL hits `import()` with a bogus locale and surfaces as opaque MODULE_NOT_FOUND.
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
