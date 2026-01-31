import createIntlMiddleware from "next-intl/middleware";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import type { Locale } from "@/i18n/config";
import { routing } from "@/i18n/routing";
import { auth } from "@/server/auth";

/**
 * Next.js 16 proxy (replacement for `middleware.ts`) — composes the
 * next-intl locale router with the app's session-aware auth guard
 * and the shared-link locale auto-redirect.
 *
 * @remarks
 * Request handling, in order — flat guard chain, each branch returns:
 *
 *   1. `/api/*` — locale-agnostic, authed via `withAuth` / `withPublicKey`
 *      HOFs. Bypass both the intl middleware (which would otherwise
 *      rewrite `/api/organizations` to `/en/api/organizations` and 404
 *      at Next.js routing) and the auth-redirect branch (API clients
 *      expect JSON 401 from the HOF, not an HTML redirect).
 *   2. `bypassPaths` — non-`/api/` surfaces that authenticate themselves
 *      (SDK test playground). Skip auth and intl.
 *   3. Resolve `session` (via `auth()`), `canonical` (via
 *      `stripLocalePrefix`), `urlLocale` (via `getUrlLocale`), and
 *      `preferredLocale` (DB preference for authed, URL prefix for anon).
 *   4. Auth paths (`/sign-in`, `/sign-up`) — authed users bounce to
 *      `/users` in their preferred locale; anon users fall through to
 *      intl (URL locale retained so the sign-in screen matches whatever
 *      language the visitor navigated from).
 *   5. Protected paths (`/users`, `/replays`, `/settings`) + anon →
 *      redirect to `/sign-in` with the visitor's URL locale prefix
 *      retained and `callbackUrl` carrying the original pathname-plus-
 *      query. After sign-in, the callback lands them there; step 6 then
 *      flips locale to the new DB preference if it differs.
 *   6. **Locale mismatch for authed users** — if `urlLocale` doesn't
 *      equal `session.user.locale`, 307-redirect to the same canonical
 *      path under the preferred locale with `?query` preserved on the
 *      wire and `#fragment` preserved by the browser. Enables the
 *      "colleague A (EN) shares a link with colleague B (UK)" flow
 *      without any coordination — B lands on UK regardless of URL.
 *
 * Root (`/`) is deliberately absent from this guard chain — it hosts
 * the public marketing landing (`(marketing)/page.tsx`) that both
 * anonymous and authenticated visitors can reach. The header CTA on
 * that page reads session-side and points authed users at the
 * dashboard, so there's no need for a proxy-level redirect.
 *
 *   7. `intlMiddleware(request)` — final fallthrough. next-intl rewrites
 *      the URL to its `[locale]/…` internal form, sets
 *      `x-next-intl-locale`, and (under `localePrefix: "as-needed"`)
 *      308-redirects `/en/path` → `/path` so the default locale never
 *      carries a redundant prefix.
 *
 * The `matcher` skips `_next/*`, favicons, and `/assets/*` so this
 * function never runs for static files — edge cost is bounded to paths
 * that need an auth or locale decision.
 *
 * @see src/i18n/routing.ts — locale registry + prefix strategy.
 * @see src/server/auth/index.ts — `auth()` factory consumed here.
 * @see src/app/[locale]/(dashboard)/settings/user/components/locale-section.tsx —
 *   the counterpart explicit-switch flow that updates `User.locale` so
 *   step 7 converges without a redirect loop.
 */

/**
 * Non-`/api/` paths that still bypass both auth and intl — primarily
 * the SDK test playground. All `/api/*` routes bypass too, handled by
 * the early `startsWith("/api")` check inside the proxy (not listed
 * here to avoid duplication).
 */
const bypassPaths = ["/test-tracker"];

/** Auth pages — authenticated users get redirected to the dashboard. */
const authPaths = ["/sign-in", "/sign-up"];

/**
 * Authenticated-only path prefixes. Anonymous visitors hitting these
 * are redirected to `/sign-in` with `callbackUrl` preserved; every
 * other path (known auth page, root, or genuinely unknown route) is
 * passed through to Next.js routing so `not-found.tsx` can render
 * when appropriate.
 *
 * Each entry must match the top-level prefix of a real protected
 * segment in `(dashboard)/*`. Adding a new protected route group
 * here is a one-line change.
 */
const protectedPrefixes = ["/users", "/replays", "/settings"];

const intlMiddleware = createIntlMiddleware(routing);

function matchesAny(pathname: string, paths: string[]): boolean {
  return paths.some((path) => pathname === path || pathname.startsWith(path + "/"));
}

/**
 * Drops the leading `/{locale}` segment from a pathname when it
 * corresponds to a supported locale — so auth-guard branches below
 * can compare against `/sign-in` without caring whether the URL was
 * requested as `/sign-in` (default) or `/uk/sign-in` (non-default).
 */
function stripLocalePrefix(pathname: string): string {
  for (const locale of routing.locales) {
    if (pathname === `/${locale}`) return "/";
    if (pathname.startsWith(`/${locale}/`)) return pathname.slice(`/${locale}`.length);
  }
  return pathname;
}

/**
 * Read the locale prefix off the URL. Default-locale URLs carry no
 * prefix under `localePrefix: "as-needed"`, so anything that isn't a
 * non-default locale segment reads as the default.
 */
function getUrlLocale(pathname: string): Locale {
  for (const locale of routing.locales) {
    if (locale === routing.defaultLocale) continue;
    if (pathname === `/${locale}` || pathname.startsWith(`/${locale}/`)) {
      return locale;
    }
  }
  return routing.defaultLocale;
}

/**
 * Prepend the locale segment to a canonical pathname, or return it
 * unchanged when the target is the default locale (as-needed prefix).
 * Pairs with {@link stripLocalePrefix} — together they round-trip a
 * path through any supported locale without any bespoke splitting.
 */
function withLocalePrefix(canonical: string, locale: Locale): string {
  if (locale === routing.defaultLocale) return canonical;
  return `/${locale}${canonical}`;
}

/**
 * Build an absolute redirect target that preserves the original query
 * string. Fragment (`#hash`) is NOT on the wire in any HTTP redirect,
 * but every modern browser re-attaches the original fragment to the
 * `Location` URL automatically — so a shared link like
 * `/en/users/abc?tab=events#top` redirected to `/uk/users/abc?tab=events`
 * lands on `/uk/users/abc?tab=events#top` without any help from us.
 */
function buildRedirectUrl(canonical: string, locale: Locale, request: NextRequest): URL {
  return new URL(withLocalePrefix(canonical, locale) + request.nextUrl.search, request.url);
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // API routes: every `/api/*` is locale-agnostic and gated by the
  // per-route HOF (`withAuth` / `withPublicKey`). Returning `next()`
  // early keeps intl from rewriting them into a `[locale]/api/*`
  // path that doesn't exist (Next.js would 404) and stops the
  // anonymous-redirect branch from flipping JSON 401s into HTML
  // redirects to `/sign-in`.
  if (pathname.startsWith("/api")) {
    return NextResponse.next();
  }

  if (matchesAny(pathname, bypassPaths)) {
    return NextResponse.next();
  }

  const session = await auth();
  const isAuthenticated = !!session?.user;
  const canonical = stripLocalePrefix(pathname);
  const urlLocale = getUrlLocale(pathname);

  // Preferred locale for this request:
  //   - Authed → persisted preference on the user row (wins over URL).
  //   - Anon   → whatever the URL asked for (so a shared link retains
  //              its language through sign-in via callbackUrl; once the
  //              callback restores the visitor's DB preference, the
  //              mismatch branch below flips the URL to their locale).
  const preferredLocale: Locale = isAuthenticated ? session.user.locale : urlLocale;

  if (matchesAny(canonical, authPaths)) {
    if (isAuthenticated) {
      return NextResponse.redirect(buildRedirectUrl("/users", preferredLocale, request));
    }
    return intlMiddleware(request);
  }

  if (!isAuthenticated && matchesAny(canonical, protectedPrefixes)) {
    // `callbackUrl` captures the original pathname WITH its locale
    // prefix. After sign-in the callback lands the visitor there;
    // the locale-mismatch branch below then swings them from the
    // sender's locale to the recipient's preferred one if they differ
    // — so shared links "just work" across locale preferences.
    const signInUrl = new URL(withLocalePrefix("/sign-in", preferredLocale), request.url);
    signInUrl.searchParams.set("callbackUrl", pathname + request.nextUrl.search);
    return NextResponse.redirect(signInUrl);
  }

  // Authed visitor on a URL whose locale doesn't match their preference.
  //
  // Primary user story: colleague A (EN) sends
  // `/en/users/abc?tab=events#top` to colleague B (UK). B opens it,
  // gets auto-redirected to `/uk/users/abc?tab=events` with query
  // preserved on the wire and fragment preserved by the browser.
  //
  // Explicit locale switches via `<LocaleSection>` update `User.locale`
  // + `session.update()` + `router.replace(pathname, { locale })` in one
  // React transition — JWT refreshes before the next middleware run, so
  // the URL converges to the new preferred prefix without a redirect
  // loop.
  //
  // Anonymous visitors are left alone — they keep whatever locale the
  // URL advertised until sign-in associates them with a persisted
  // preference.
  //
  // Root (`/`) is carved out: the marketing header hosts a compact
  // locale picker meant for previewing translations. Flipping authed
  // users back to their persisted preference there would defeat the
  // picker — the other auth-guarded branches already keep dashboard
  // surfaces on the user's preferred locale.
  if (isAuthenticated && urlLocale !== preferredLocale && canonical !== "/") {
    return NextResponse.redirect(buildRedirectUrl(canonical, preferredLocale, request));
  }

  return intlMiddleware(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, favicon.svg (favicon files)
     * - public assets
     * - metadata routes (robots.txt, sitemap.xml) — served by
     *   `src/app/robots.ts` / `src/app/sitemap.ts`; the intl
     *   middleware would otherwise rewrite them to `/<locale>/robots.txt`
     *   and hit a 404.
     * - opengraph-image (Next.js convention file served at
     *   `/<locale>/opengraph-image` etc.; kept outside so the intl
     *   rewrite doesn't touch its response).
     */
    "/((?!_next/static|_next/image|favicon\\.ico|favicon\\.svg|assets/|robots\\.txt|sitemap\\.xml|opengraph-image).*)",
  ],
};
