import "server-only";
import { randomBytes } from "node:crypto";

import type { ApiKeyPlaintext } from "@/lib/mask-api-key";

/**
 * Format `dp_<32-char-hex>` — `dp_` is the prefix the masker keys on. This is the
 * sole construction site for the `ApiKeyPlaintext` brand; every other appearance
 * is an `as ApiKeyPlaintext` cast on a Prisma read-back. Plaintext leaves the
 * server only via the dedicated uncached `GET /api/projects/[id]/key` route.
 */
export function generateApiKey(): ApiKeyPlaintext {
  return `dp_${randomBytes(16).toString("hex")}` as ApiKeyPlaintext;
}
