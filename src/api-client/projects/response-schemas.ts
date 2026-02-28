import { z } from "zod";

/**
 * Response DTO schemas for the `projects` feature.
 *
 * @remarks
 * Note on key material: `maskedKey` and `key` are both `z.string()`
 * here — the `ApiKeyMasked` / `ApiKeyPlaintext` brands live inside
 * server-only handlers (`lib/mask-api-key.ts`, `server/generate-api-
 * key.ts`) and are stripped at the DTO boundary on purpose. The
 * **route-level handling** is what enforces the trust separation
 * (masked in list responses, plaintext only from `/key` and
 * `/regenerate-key` — each OWNER-guarded, each `Cache-Control:
 * no-store`). The wire-layer schema doesn't re-encode the brand
 * because brands are erased at emit and have no runtime shape to
 * validate.
 *
 * @see src/lib/mask-api-key.ts — branded types + client-safe mask helper.
 * @see src/server/generate-api-key.ts — key generation + Prisma read cast.
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

/**
 * Plaintext key payload — returned ONLY by `GET /api/projects/[id]/key`
 * (fetch-on-copy) and `POST /api/projects/[id]/regenerate-key`. Never
 * part of the list shape or the standard detail payload.
 */
export const projectKeySchema = z.object({
  key: z.string(),
});

export const projectListSchema = z.array(projectSchema);
