import { withSentryConfig } from "@sentry/nextjs";
import { createMDX } from "fumadocs-mdx/next";
import createNextIntlPlugin from "next-intl/plugin";
import type { NextConfig } from "next";

/**
 * next-intl compile-time plugin — points the runtime at our request
 * config so `getTranslations()` / `<NextIntlClientProvider>` / the
 * middleware all resolve to the same locale + messages source.
 *
 * Path is explicit (rather than relying on the default lookup) so a
 * future move of `src/i18n/request.ts` breaks at config load time
 * instead of silently falling back to an empty message bundle.
 */
const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

/**
 * Fumadocs MDX plugin — runs the codegen for `source.config.ts` on
 * `next dev` / `next build`, regenerating `.source/` (gitignored). The
 * docs zone reads from that codegen via `src/lib/source.ts`.
 *
 * @see source.config.ts — content registry the codegen consumes.
 */
const withMDX = createMDX();

/**
 * Security headers applied to every non-static response.
 *
 * @remarks
 * Intentionally conservative and CSP-less for now — a proper CSP
 * requires per-request nonces (Next.js inline scripts + Radix styles
 * would need allowances) and is a separate scope. The headers below
 * still close the common low-effort attack vectors:
 *
 *   - `X-Frame-Options: DENY` — blocks clickjacking by refusing to
 *      render the dashboard inside an iframe of any origin.
 *   - `X-Content-Type-Options: nosniff` — forces the browser to
 *      respect the declared `Content-Type` instead of MIME-sniffing,
 *      closing a class of XSS vectors on user-uploaded content.
 *   - `Referrer-Policy: strict-origin-when-cross-origin` — default
 *      in modern browsers, but pinned here so behaviour doesn't drift
 *      if a downstream proxy strips it.
 *   - `Permissions-Policy` — disables camera / microphone / geolocation
 *      APIs the dashboard never uses, so a compromised third-party
 *      script still can't reach them without an explicit allow-list.
 */
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  reactCompiler: true,
  experimental: {
    optimizePackageImports: ["@phosphor-icons/react"],
    /**
     * Enables `src/app/global-not-found.tsx` as a standalone 404 page
     * for URLs that don't match any route (including requests like
     * `/404` itself, where the `[locale]` dynamic segment captures
     * `"404"` as an invalid locale and `notFound()` fires from the
     * layout — too early for `[locale]/not-found.tsx` to render
     * within a layout chain). See the file's own JSDoc for the
     * self-contained-HTML contract that comes with bypassing layouts.
     */
    globalNotFound: true,
  },
  images: {
    remotePatterns: [{ hostname: "api.dicebear.com" }],
  },
  headers: async () => [
    {
      // Apply to every path except Next.js internals and static assets.
      // Matching on every route rather than narrower globs because the
      // attack-surface benefit (clickjacking / MIME sniffing) is
      // path-agnostic.
      source: "/:path*",
      headers: securityHeaders,
    },
  ],
  redirects: async () => [
    // `/settings` → `/settings/user`: the settings area has sub-routes
    // only, so the bare segment needs an explicit destination. Root
    // (`/`) is intentionally NOT redirected — it hosts the marketing
    // landing, which every visitor (authed or anon) should be able
    // to reach directly.
    { source: "/settings", destination: "/settings/user", permanent: false },

    // `/documentation` → first slug. Bare `/documentation` doesn't
    // match the catch-all `[...slug]` (zero-segment requires the
    // optional `[[...slug]]` form, which we deliberately don't use —
    // it'd swallow this redirect target). The Notebook sidebar's
    // labelled groups surface the four sections once visitors land
    // inside; the entry hop just picks the canonical first page so
    // there's a single place to change it.
    {
      source: "/documentation",
      destination: "/documentation/introduction",
      permanent: false,
    },
  ],
};

/**
 * Sentry build-time wrapper.
 *
 * @remarks
 * Enables source-map upload during `next build` so production stack
 * traces resolve to original symbols instead of minified `_0` / `e.t`.
 * Vendor-neutral: `org` / `project` / `authToken` are all read from
 * `process.env`, so a self-hoster without a Sentry account leaves them
 * unset and the wrapper silently skips upload — the build still
 * succeeds. Same self-host-first contract as `SENTRY_DSN`.
 *
 * `silent: true` keeps the build log clean even in CI where stdout is
 * usually noisy.
 */
export default withSentryConfig(withMDX(withNextIntl(nextConfig)), {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: true,
  widenClientFileUpload: true,
});
