import { defineRouting } from "next-intl/routing";

import { DEFAULT_LOCALE, LOCALES } from "./config";

/**
 * Routing contract. `localePrefix: "as-needed"` keeps the default locale unprefixed
 * (`/users`) and prefixes others (`/uk/users`). `localeDetection: false` is
 * load-bearing: the cookie + Accept-Language heuristic would fight `src/proxy.ts`'s
 * authed-user locale-flip and loop redirects (anon `/uk/sign-in` writes the cookie
 * → user with `User.locale="en"` signs in → proxy flips `/uk/...` → `/...` →
 * next-intl re-prefixes from cookie → loop). Proxy is the single authority on
 * locale; URL is the single routing input.
 *
 * Keep this file tiny — imported by both the edge middleware and client nav hooks,
 * and next-intl generates different code paths per entry.
 */
export const routing = defineRouting({
  locales: LOCALES,
  defaultLocale: DEFAULT_LOCALE,
  localePrefix: "as-needed",
  localeDetection: false,
});
