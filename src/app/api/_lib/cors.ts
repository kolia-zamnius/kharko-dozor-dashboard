import "server-only";

/**
 * `Allow-Origin: *` is safe — public-key auth (`X-Dozor-Public-Key` header)
 * has no cookie/CSRF surface that an origin allow-list would protect.
 * `Content-Encoding` allowed because the ingest SDK gzips batches.
 */
export const PUBLIC_KEY_CORS_HEADERS = Object.freeze({
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Content-Encoding, X-Dozor-Public-Key",
} as const) satisfies Readonly<Record<string, string>>;

/** Re-exported from each public-key route as `export const OPTIONS = corsPreflightResponse`. */
export function corsPreflightResponse(): Response {
  return new Response(null, { status: 204, headers: PUBLIC_KEY_CORS_HEADERS });
}

export function addCorsHeaders<R extends Response>(response: R): R {
  for (const [key, value] of Object.entries(PUBLIC_KEY_CORS_HEADERS)) {
    response.headers.set(key, value);
  }
  return response;
}
