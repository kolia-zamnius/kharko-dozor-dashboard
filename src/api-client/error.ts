/**
 * Client-side representation of an API failure.
 *
 * @remarks
 * The HTTP boundary gives us a `status` number and a server-supplied
 * `message`. Both are preserved, but every call site cares about one
 * of a small number of **semantic** failure categories — is this a
 * "need to sign in", an "access denied", a "conflict, try again with
 * different input"? Comparing `err.status === 409` at a dozen call
 * sites is stringly-typed-numerically and invites silent breakage
 * when the server adds or narrows a status.
 *
 * Instead, `apiFetch` classifies the response into an `ApiErrorKind`
 * once, at the boundary, and every downstream consumer narrows on
 * `err.kind`. New kinds are added here; the compiler then walks every
 * `switch (err.kind)` or `if (err.kind === ...)` and flags missing
 * branches (with `@typescript-eslint/switch-exhaustiveness-check` +
 * `assertNever`). The raw `status` stays on the instance for logging
 * and for the rare case where a caller genuinely cares about the
 * exact code (e.g. a rate-limiter reading `Retry-After`).
 *
 * Convention for mapping status → kind:
 *   - `401`                 → `"auth"`         (not signed in / session expired)
 *   - `403`                 → `"permission"`   (signed in but lacking rank)
 *   - `404`                 → `"not-found"`
 *   - `409`                 → `"conflict"`
 *   - `422`, `400`          → `"validation"`   (bad input, schema rejection)
 *   - `429`                 → `"rate-limit"`
 *   - `5xx`                 → `"server"`
 *   - anything else / fetch → `"network"`      (default fallback)
 */
export type ApiErrorKind =
  | "auth"
  | "permission"
  | "not-found"
  | "conflict"
  | "validation"
  | "rate-limit"
  | "server"
  | "network";

export class ApiError extends Error {
  constructor(
    readonly kind: ApiErrorKind,
    readonly status: number,
    message: string,
    options?: { cause?: unknown },
  ) {
    // `Error.cause` is ES2022 — propagates the original error (fetch
    // rejection, response parse failure, etc.) so a DevTools
    // drill-down shows the full chain instead of stopping at our
    // wrapper message. `super(message, options)` works regardless of
    // whether `cause` is provided; passing `undefined` is a no-op.
    super(message, options);
    this.name = "ApiError";
  }
}

/**
 * Classify a concrete HTTP status into its semantic `ApiErrorKind`.
 *
 * @remarks
 * Called from `apiFetch` once per failing response; consumers never
 * have to duplicate this table. Returns `"server"` for every 5xx
 * (including unknown codes in that range) and `"network"` for
 * anything outside the documented HTTP spec, which is also the
 * default `apiFetch` falls back to when `fetch` throws before a
 * response is received.
 */
export function classifyHttpStatus(status: number): ApiErrorKind {
  if (status === 401) return "auth";
  if (status === 403) return "permission";
  if (status === 404) return "not-found";
  if (status === 409) return "conflict";
  if (status === 400 || status === 422) return "validation";
  if (status === 429) return "rate-limit";
  if (status >= 500 && status < 600) return "server";
  return "network";
}

/**
 * Type guard for narrowing `unknown` catch values.
 *
 * @remarks
 * Twin of `isHttpError` on the server boundary — lets client-side
 * catch handlers narrow without `instanceof` rituals.
 */
export function isApiError(err: unknown): err is ApiError {
  return err instanceof ApiError;
}
