import "server-only";

/**
 * CORS headers for public-key endpoints called cross-origin from SDK-instrumented pages.
 *
 * @remarks
 * `Access-Control-Allow-Origin: *` is safe here: these endpoints
 * authenticate via the `X-Dozor-Public-Key` header (project-scoped,
 * regeneratable), not via cookies/sessions — no CSRF surface that an
 * origin allow-list would protect. The key is the credential; the
 * origin is irrelevant.
 *
 * `Content-Encoding` is allow-listed because the ingest SDK gzips event
 * batches. Cancel doesn't strictly need it; one allow-list simplifies
 * inspection with negligible incremental surface.
 *
 * Frozen so stray mutations can't corrupt the preflight response mid-request.
 */
export const PUBLIC_KEY_CORS_HEADERS = Object.freeze({
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Content-Encoding, X-Dozor-Public-Key",
} as const) satisfies Readonly<Record<string, string>>;

/**
 * Canonical 204 response for CORS preflight (`OPTIONS`) on public-key endpoints.
 *
 * @remarks
 * Exported as a function so each route re-exports it in one line:
 * `export const OPTIONS = corsPreflightResponse;`.
 */
export function corsPreflightResponse(): Response {
  return new Response(null, { status: 204, headers: PUBLIC_KEY_CORS_HEADERS });
}

/**
 * Decorate an existing `Response` with {@link PUBLIC_KEY_CORS_HEADERS}.
 *
 * @remarks
 * Used by {@link withPublicKey} so route handlers can return a plain
 * `Response` / `NextResponse.json(...)` without threading headers
 * through every exit path. The wrapper applies CORS once on the way
 * out and to every auto-generated error response.
 *
 * @param response - Response to decorate (mutated in place then returned).
 */
export function addCorsHeaders<R extends Response>(response: R): R {
  for (const [key, value] of Object.entries(PUBLIC_KEY_CORS_HEADERS)) {
    response.headers.set(key, value);
  }
  return response;
}
