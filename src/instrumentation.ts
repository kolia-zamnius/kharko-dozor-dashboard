/**
 * Sentry filtering is architectural: `withAuth` / `withPublicKey` HOFs convert
 * `HttpError` and `ZodError` into HTTP responses BEFORE they bubble out, so
 * anything reaching `onRequestError` is a genuine bug — no allow/deny list needed.
 */

import * as Sentry from "@sentry/nextjs";

export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("../sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("../sentry.edge.config");
  }
}

export const onRequestError = Sentry.captureRequestError;
