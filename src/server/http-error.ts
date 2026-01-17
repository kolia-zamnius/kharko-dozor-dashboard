import "server-only";

/**
 * Server-wide structured error with an HTTP status code.
 *
 * @remarks
 * Thrown from **three** places so there is one source of truth for
 * "this path failed, here is the HTTP status the client should see":
 *
 *   - API route handlers — caught by the `withAuth` / `withPublicKey`
 *     HOFs in `src/app/api/_lib/` and serialized to `NextResponse`.
 *   - Permission helpers in `src/server/auth/permissions.ts` — so a
 *     missing-membership check surfaces as a real 403 from the route
 *     that called the helper.
 *   - Server-side data loaders (e.g. `src/server/tracked-users.ts`)
 *     — so `loadTrackedUserDetail` and friends can throw `404` / `403`
 *     directly and let the outer route adapter render the response.
 *
 * Lives at `src/server/` (not `src/app/api/_lib/`) precisely because
 * more than just the API layer throws it.
 *
 * @see src/app/api/_lib/with-auth.ts — primary catch site.
 */
export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    options?: { cause?: unknown },
  ) {
    // `Error.cause` (ES2022) preserves the original error when a
    // loader wraps a Prisma / upstream failure into a user-facing
    // status code. The boundary HOFs don't forward `cause` into the
    // JSON response (clients see only `message` + `status`), but the
    // chain is intact in server logs and `console.error` output.
    super(message, options);
    this.name = "HttpError";
  }
}

/**
 * Type guard for narrowing `unknown` in catch handlers.
 *
 * @remarks
 * Prefer this over bare `instanceof HttpError` at boundary call sites
 * — the `err is HttpError` predicate is the ergonomic part: once the
 * guard passes, `err.status` and `err.message` are typed, without a
 * cast. Backed by `instanceof` today because we control all throw
 * sites; if we ever ship cross-bundle code paths that could duplicate
 * the class, swap the body for a brand-symbol check without changing
 * any call site.
 */
export function isHttpError(err: unknown): err is HttpError {
  return err instanceof HttpError;
}
