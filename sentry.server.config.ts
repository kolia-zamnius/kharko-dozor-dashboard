/**
 * Sentry init for the Node.js (server) runtime.
 *
 * @remarks
 * Loaded ONCE per cold start via `src/instrumentation.ts::register`.
 * If `SENTRY_DSN` is absent (local dev, self-hoster who didn't sign up,
 * test runs), `Sentry.init` is a no-op — every subsequent capture call
 * also no-ops. Zero config required to disable Sentry; just unset DSN.
 *
 * ### What we send
 * Only errors that escape `withAuth` / `withPublicKey` reach this layer
 * — see `src/instrumentation.ts` for the architectural reasoning.
 * 4xx HTTP responses (auth, validation, not-found, conflict, rate-
 * limit) are deliberately NOT here.
 *
 * ### What we DON'T send (PII / secrets)
 * `beforeSend` strips fields that could correlate to a specific human
 * or unlock a session: cookies, auth headers, raw API keys, OAuth
 * tokens. The principle mirrors the production-only redact list in
 * `src/server/logger.ts` — both layers use it independently because
 * Sentry events go through different serialization than pino.
 *
 * ### Sampling
 *   - Errors: 100% (rare events; we want every one)
 *   - Traces: 10% in prod, 0% in dev (avoid noise during development)
 */

import * as Sentry from "@sentry/nextjs";

// Boot-time warning so a missing prod DSN doesn't silently swallow
// every error for weeks. Dev / test runs without DSN are fine —
// that's the intended local UX. Plain `console.warn` (not pino) so
// this file stays free of cross-module imports during instrumentation.
if (process.env.NODE_ENV === "production" && !process.env.SENTRY_DSN) {
  console.warn("[sentry] disabled in production — set SENTRY_DSN to enable error reporting");
}

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  enabled: Boolean(process.env.SENTRY_DSN),

  // Vendor-neutral release / environment markers. `SENTRY_RELEASE` is
  // typically the git sha (Vercel: `VERCEL_GIT_COMMIT_SHA`, Fly: a CI
  // export, Docker self-host: a build arg); `SENTRY_ENVIRONMENT`
  // distinguishes prod / staging / dev so issues don't pile into one
  // bucket. Both unset → Sentry falls back to its own defaults
  // (timestamp release, "production" env). Self-host-first: no Vercel
  // env names referenced here.
  release: process.env.SENTRY_RELEASE,
  environment: process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV,

  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 0,

  // Tighter integration with Next.js stack frames + better source-map
  // resolution. No-op when DSN is unset.
  sendDefaultPii: false,

  beforeSend(event) {
    // Defensive PII strip. The architecture already prevents 4xx
    // (the only category that carries the most sensitive request
    // bodies) from reaching here, but we belt-and-braces redact the
    // headers that any 5xx might still carry.
    if (event.request?.headers) {
      const headers = event.request.headers as Record<string, string>;
      delete headers.cookie;
      delete headers.authorization;
      delete headers["x-dozor-public-key"];
    }

    // Strip any `email`/`password`/`token` keys that snuck into extra
    // context via `Sentry.setContext` or breadcrumbs.
    if (event.extra) {
      for (const key of Object.keys(event.extra)) {
        if (/email|password|token|secret|key/i.test(key)) {
          event.extra[key] = "[REDACTED]";
        }
      }
    }

    return event;
  },
});
