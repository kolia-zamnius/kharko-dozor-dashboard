import * as Sentry from "@sentry/nextjs";

// Loud warning if prod misses DSN — otherwise errors silently swallowed for weeks.
// `console.warn` (not pino) — instrumentation runs before logger is wired.
if (process.env.NODE_ENV === "production" && !process.env.SENTRY_DSN) {
  console.warn("[sentry] disabled in production — set SENTRY_DSN to enable error reporting");
}

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  enabled: Boolean(process.env.SENTRY_DSN),

  release: process.env.SENTRY_RELEASE,
  environment: process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV,

  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 0,

  sendDefaultPii: false,

  beforeSend(event) {
    // Defensive PII strip — architecture already keeps 4xx out, but 5xx may still carry these.
    if (event.request?.headers) {
      const headers = event.request.headers as Record<string, string>;
      delete headers.cookie;
      delete headers.authorization;
      delete headers["x-dozor-public-key"];
    }

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
