/**
 * Branded types that encode the secret-handling invariant in the type
 * system: routes can't accidentally return plaintext where they meant
 * to return masked, and clients can't silently feed a masked string
 * back into an operation that expects the raw key.
 *
 * @remarks
 * The brand key is a `declare const unique symbol` — no runtime cost
 * (it's erased on compile) and no way for consumer code to forge a
 * value of either type without an explicit `as` cast, which doubles
 * as a code-review marker wherever we deliberately cross the trust
 * boundary (e.g. reading `project.key` back from Prisma and promising
 * "I trust that what the DB handed me is a plaintext key").
 *
 * Both types are still assignable **to** `string`, so every existing
 * consumer that takes a plain string (Prisma fields, JSON
 * serialisation, `NextResponse.json`) keeps working untouched.
 */
declare const API_KEY_BRAND: unique symbol;

/** Raw API key in the `dp_<32-hex>` form produced by `generateApiKey()`. */
export type ApiKeyPlaintext = string & { readonly [API_KEY_BRAND]: "plaintext" };

/** Display-safe form produced by `maskApiKey()` — safe to log, cache, ship to the client. */
export type ApiKeyMasked = string & { readonly [API_KEY_BRAND]: "masked" };

/**
 * Mask an API key for display.
 *
 * @remarks
 * Keeps the `dp_` prefix, the first 4 and last 4 characters of the body,
 * and replaces the middle with bullets. The bullet count is clamped to
 * a minimum of 4 so a short/malformed body still reads as "masked" and
 * not as "the real key was this short".
 *
 * Client-safe: no Node-only dependencies, so Server Components, Client
 * Components, and Edge runtime can all import this directly. The
 * server-only counterpart that **generates** raw keys lives at
 * `src/server/generate-api-key.ts` — the split is by crypto dependency.
 * The branded input/output types live here (client-safe) because they
 * are pure types, erased at compile time, and the masked type is the
 * client-consumed form.
 *
 * @example
 * ```ts
 * const raw = generateApiKey();  // ApiKeyPlaintext
 * const safe = maskApiKey(raw);  // ApiKeyMasked — "dp_abc1••••••••••••••j012"
 * maskApiKey(safe);              // ❌ compile error — already masked
 * ```
 *
 * @see src/server/generate-api-key.ts — server-only twin producing `ApiKeyPlaintext`.
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
