import createIntlMiddleware from "next-intl/middleware";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import type { Locale } from "@/i18n/config";
import { routing } from "@/i18n/routing";
import { auth } from "@/server/auth";

/**
 * Composes the next-intl locale router with auth + shared-link
 * locale auto-redirect.
 *
 * @see src/i18n/routing.ts — locale registry.
 * @see src/server/auth/index.ts — `auth()` factory.
 */

/** Paths that skip both auth and intl. Documented per entry below. */
const bypassPaths = [
  // English-only docs zone, lives outside the `[locale]/` pipeline.
  "/documentation",
  // SDK playground — paste-key-and-test, lives alongside the docs zone.
  // Public on purpose: the user pastes their own project key, no auth needed.
  "/playground",
  // llms.txt convention — plain-text docs dump for AI agents.
  "/llms.txt",
];

const authPaths = ["/sign-in", "/sign-up"];

const protectedPrefixes = ["/users", "/replays", "/settings"];

const intlMiddleware = createIntlMiddleware(routing);

function matchesAny(pathname: string, paths: string[]): boolean {
  return paths.some((path) => pathname === path || pathname.startsWith(path + "/"));
}

/** Drop a leading `/{locale}` segment so guards compare against canonical paths. */
function stripLocalePrefix(pathname: string): string {
  for (const locale of routing.locales) {
    if (pathname === `/${locale}`) return "/";
    if (pathname.startsWith(`/${locale}/`)) return pathname.slice(`/${locale}`.length);
  }
  return pathname;
}

/** Read the locale from the URL prefix; default-locale URLs carry no prefix. */
function getUrlLocale(pathname: string): Locale {
  for (const locale of routing.locales) {
    if (locale === routing.defaultLocale) continue;
    if (pathname === `/${locale}` || pathname.startsWith(`/${locale}/`)) {
      return locale;
    }
  }
  return routing.defaultLocale;
}

function withLocalePrefix(canonical: string, locale: Locale): string {
  if (locale === routing.defaultLocale) return canonical;
  return `/${locale}${canonical}`;
}

/**
 * Build a redirect URL preserving the original `?query`. The `#fragment`
 * is never on the wire but every browser re-attaches it from the
 * original Location, so shared links keep their hash through the redirect.
 */
function buildRedirectUrl(canonical: string, locale: Locale, request: NextRequest): URL {
  return new URL(withLocalePrefix(canonical, locale) + request.nextUrl.search, request.url);
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // `/api/*` — locale-agnostic, gated by per-route HOFs (`withAuth`/
  // `withPublicKey`). Intl rewrite would 404 them; auth redirect would
  // turn JSON 401s into HTML.
  if (pathname.startsWith("/api")) return NextResponse.next();
  if (matchesAny(pathname, bypassPaths)) return NextResponse.next();

  const session = await auth();
  const isAuthenticated = !!session?.user;
  const canonical = stripLocalePrefix(pathname);
  const urlLocale = getUrlLocale(pathname);

  // Authed visitors prefer their persisted DB locale; anon retain whatever
  // the URL asked for (so a shared link survives sign-in via `callbackUrl`).
  const preferredLocale: Locale = isAuthenticated ? session.user.locale : urlLocale;

  if (matchesAny(canonical, authPaths)) {
    if (isAuthenticated) {
      return NextResponse.redirect(buildRedirectUrl("/users", preferredLocale, request));
    }
    return intlMiddleware(request);
  }

  if (!isAuthenticated && matchesAny(canonical, protectedPrefixes)) {
    // `callbackUrl` keeps the locale prefix — the post-sign-in landing is
    // then either the original URL (matching prefs) or auto-flipped by
    // the locale-mismatch branch below.
    const signInUrl = new URL(withLocalePrefix("/sign-in", preferredLocale), request.url);
    signInUrl.searchParams.set("callbackUrl", pathname + request.nextUrl.search);
    return NextResponse.redirect(signInUrl);
  }

  // Auto-flip the URL to the user's preferred locale — primary user
  // story: colleague A (EN) shares `/en/users/abc` with colleague B (UK),
  // B lands on `/uk/users/abc` without coordination.
  //
  // `/` is carved out so the marketing header's locale preview picker
  // still works for authed visitors.
  if (isAuthenticated && urlLocale !== preferredLocale && canonical !== "/") {
    return NextResponse.redirect(buildRedirectUrl(canonical, preferredLocale, request));
  }

  return intlMiddleware(request);
}

export const config = {
  // Skip static + metadata routes; intl rewrite would otherwise 404 the
  // file-based ones (robots.txt, sitemap.xml, opengraph-image).
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|favicon\\.svg|assets/|robots\\.txt|sitemap\\.xml|opengraph-image).*)",
  ],
};
