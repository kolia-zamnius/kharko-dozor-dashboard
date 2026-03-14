import { defineRouting } from "next-intl/routing";

import { DEFAULT_LOCALE, LOCALES } from "./config";

/**
 * Next-intl routing contract consumed by the middleware layer in
 * `src/proxy.ts` and the typed navigation helpers in `./navigation.ts`.
 *
 * @remarks
 * `localePrefix: "as-needed"` means the default locale renders without
 * a URL prefix (`/users`) while non-default locales carry one
 * (`/uk/users`). This keeps existing bookmarks and SEO signals stable
 * for the English default, and avoids the "every URL gains a prefix"
 * migration that `"always"` would force.
 *
 * `localeDetection: false` is load-bearing — without it next-intl reads
 * the `NEXT_LOCALE` cookie + `Accept-Language` header on every request
 * and may rewrite a URL to match. That fights `proxy.ts`'s authed-user
 * locale-flip and creates a redirect loop in this exact scenario:
 *
 *   1. Anon visits `/uk/sign-in`. next-intl writes `NEXT_LOCALE=uk`.
 *   2. User signs in with a `User.locale="en"` account; NextAuth
 *      bounces to `callbackUrl=/uk/users`.
 *   3. Proxy locale-mismatch flips `/uk/users` → `/users` (canonical).
 *   4. next-intl middleware sees `NEXT_LOCALE=uk` cookie and redirects
 *      `/users` → `/uk/users`. Back to step 3 → infinite redirects.
 *
 * Disabling detection makes the URL the single routing input. Our
 * proxy holds the full priority chain (URL prefix → `User.locale` DB
 * column → `DEFAULT_LOCALE` fallback) and stays the only authority on
 * "which locale should this request render". The cookie still gets
 * WRITTEN by next-intl as a side-effect of every response — independent
 * consumers like `src/app/global-not-found.tsx` can still read it as a
 * hint when they live outside the `[locale]/` pipeline.
 *
 * Keep this file tiny — it's imported from both the edge middleware
 * and client-side navigation hooks, and next-intl generates different
 * code paths depending on which entrypoint reads it. Any heavy logic
 * belongs in `request.ts` (server) or downstream callers, not here.
 */
export const routing = defineRouting({
  locales: LOCALES,
  defaultLocale: DEFAULT_LOCALE,
  localePrefix: "as-needed",
  localeDetection: false,
});
