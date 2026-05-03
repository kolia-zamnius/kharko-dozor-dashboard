/**
 * Branded types so the type system gates the secret-handling invariant: routes can't
 * return plaintext where they meant masked, clients can't feed masked strings back
 * where raw is expected. The brand erases at compile time; both still assign to
 * `string`, so Prisma fields and `NextResponse.json()` work untouched. `as ApiKeyPlaintext`
 * is the deliberate trust-boundary marker (e.g. reading `project.key` back from Prisma).
 */
declare const API_KEY_BRAND: unique symbol;

/** Raw API key in the `dp_<32-hex>` form produced by `generateApiKey()`. */
export type ApiKeyPlaintext = string & { readonly [API_KEY_BRAND]: "plaintext" };

/** Display-safe form — first 4 + bullets + last 4. Safe to log, cache, ship to the client. */
export type ApiKeyMasked = string & { readonly [API_KEY_BRAND]: "masked" };

/**
 * Bullet count clamped to ≥4 so a malformed short key still reads as "masked",
 * not as "the real key was this short". Server-only construction lives in
 * {@link src/server/generate-api-key.ts}; this twin is client-safe (no Node deps).
 */
export function maskApiKey(key: ApiKeyPlaintext): ApiKeyMasked {
  if (!key.startsWith("dp_")) return "••••••" as ApiKeyMasked;
  const body = key.slice(3);
  if (body.length <= 8) return `dp_${"•".repeat(body.length)}` as ApiKeyMasked;
  const head = body.slice(0, 4);
  const tail = body.slice(-4);
  const dots = "•".repeat(Math.max(body.length - 8, 4));
  return `dp_${head}${dots}${tail}` as ApiKeyMasked;
}
