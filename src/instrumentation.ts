/**
 * Next.js instrumentation entry — wires Sentry into both server and
 * edge runtimes.
 *
 * @remarks
 * `register()` runs ONCE per Next.js boot, before any route handler or
 * Server Component executes. `onRequestError` runs whenever an error
 * bubbles out of route handlers / RSC code without being caught.
 *
 * ### Why `onRequestError` instead of try/catch in HOFs
 * `withAuth` and `withPublicKey` already convert `HttpError` and
 * `ZodError` into HTTP responses (4xx with a JSON body). Those
 * conversions happen INSIDE the HOF, so by the time an error reaches
 * `onRequestError` it must be UNHANDLED — a genuine bug, an infra
 * failure, or a code path the HOF doesn't model. Filtering "noisy"
 * 4xx responses out of Sentry is therefore architectural rather than
 * a list-of-exclusions: if the error reached here, we want it.
 *
 * @see src/sentry.server.config.ts
 * @see src/sentry.edge.config.ts
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
