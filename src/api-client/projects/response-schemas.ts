import { z } from "zod";

/**
 * Brands (`ApiKeyMasked` / `ApiKeyPlaintext`) don't appear here — they're erased
 * at emit and have no runtime shape to validate. Trust separation is enforced at
 * the route layer: list responses carry `maskedKey`, plaintext only from
 * `GET /[id]/key` and `POST /[id]/regenerate-key` (both OWNER-guarded,
 * `Cache-Control: no-store`).
 */

export const projectSchema = z.object({
  id: z.string(),
  name: z.string(),
  maskedKey: z.string(),
  organizationId: z.string(),
  sessionCount: z.number().int().nonnegative(),
  lastUsedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

/** Plaintext payload — returned only by fetch-key + regenerate-key routes. */
export const projectKeySchema = z.object({
  key: z.string(),
});

export const projectListSchema = z.array(projectSchema);
