/**
 * Sentry init for the Edge runtime (proxy / middleware).
 *
 * @remarks
 * Edge runtime is a strict subset of Node — no `fs`, no `node:*`
 * modules, smaller bundle budget. The init here is intentionally
 * minimal: just the DSN + sampling + a pared-down `beforeSend`.
 * Heavier integrations (profiling, native-stack source maps) live
 * in the Node config and don't apply here.
 *
 * Same enable-on-DSN-presence pattern as the server config — unset
 * DSN means no-op, no separate flag to flip.
 *
 * @see src/instrumentation.ts
 * @see sentry.server.config.ts
 */

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  enabled: Boolean(process.env.SENTRY_DSN),

  // Vendor-neutral release / environment markers — see the matching
  // block in `sentry.server.config.ts` for the full rationale.
  release: process.env.SENTRY_RELEASE,
  environment: process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV,

  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 0,

  sendDefaultPii: false,

  beforeSend(event) {
    if (event.request?.headers) {
      const headers = event.request.headers as Record<string, string>;
      delete headers.cookie;
      delete headers.authorization;
      delete headers["x-dozor-public-key"];
    }
    return event;
  },
});
