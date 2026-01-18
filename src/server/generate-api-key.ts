import "server-only";
import { randomBytes } from "node:crypto";

import type { ApiKeyPlaintext } from "@/lib/mask-api-key";

/**
 * Generate a fresh Kharko Dozor API key.
 *
 * @remarks
 * Server-only — `node:crypto` is not available in the Edge runtime and
 * the secret must never be constructed client-side. Format is
 * `dp_<32-char-hex>` (35 chars total); the `dp_` prefix is the marker
 * the display-masker looks for at `src/lib/mask-api-key.ts`.
 *
 * The return type is the `ApiKeyPlaintext` brand from
 * `lib/mask-api-key.ts`: this function is one of only two ways to
 * introduce that brand legitimately (the other being a deliberate
 * `as ApiKeyPlaintext` cast when reading back from Prisma). Every
 * call site that wants to mask, log, or persist the key has its
 * handling checked at compile time.
 *
 * Called from the project-create and regenerate-key routes, which then
 * persist the plaintext in `Project.key` (unique index). Consumers
 * receive only the masked form via `GET /api/projects/*` — the
 * plaintext is fetched on-demand via a separate endpoint that is never
 * cached.
 *
 * @see src/lib/mask-api-key.ts — client-safe twin + brand definitions.
 */
export function generateApiKey(): ApiKeyPlaintext {
  return `dp_${randomBytes(16).toString("hex")}` as ApiKeyPlaintext;
}
