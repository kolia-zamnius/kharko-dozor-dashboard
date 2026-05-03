import { withSentryConfig } from "@sentry/nextjs";
import { createMDX } from "fumadocs-mdx/next";
import createNextIntlPlugin from "next-intl/plugin";
import type { NextConfig } from "next";

/** Path explicit so a future move of `src/i18n/request.ts` breaks at config load — not silent empty bundle. */
const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const withMDX = createMDX();

/** No CSP — proper CSP needs per-request nonces (separate scope). Headers below close low-effort vectors. */
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
    /** Enables `src/app/global-not-found.tsx` for URLs the `[locale]` segment rejects (e.g. `/404` itself). */
    globalNotFound: true,
  },
  images: {
    remotePatterns: [{ hostname: "api.dicebear.com" }],
  },
  headers: async () => [
    {
      source: "/:path*",
      headers: securityHeaders,
    },
  ],
  redirects: async () => [
    // `/settings` has sub-routes only. Root `/` is intentionally NOT redirected — marketing landing lives there.
    { source: "/settings", destination: "/settings/user", permanent: false },

    // Bare `/documentation` doesn't match `[...slug]` (zero-segment requires `[[...slug]]` which we
    // deliberately don't use — it'd swallow this redirect target).
    {
      source: "/documentation",
      destination: "/documentation/introduction",
      permanent: false,
    },
  ],
};

/** Source-map upload at build. Self-hoster without Sentry leaves env vars unset — wrapper skips upload, build still succeeds. */
export default withSentryConfig(withMDX(withNextIntl(nextConfig)), {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: true,
  widenClientFileUpload: true,
});
