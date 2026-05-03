import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  enabled: Boolean(process.env.SENTRY_DSN),

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
