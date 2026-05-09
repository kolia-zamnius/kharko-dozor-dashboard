/**
 * Brands (`ApiKeyMasked` / `ApiKeyPlaintext`) don't appear here — they erase
 * at emit, no runtime shape to validate. Trust separation is enforced at the
 * route layer: list responses carry `maskedKey`, plaintext only from
 * `GET /[id]/key` and `POST /[id]/regenerate-key` (OWNER-only, `no-store`).
 */

import { z } from "zod";

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

export const createProjectSchema = z.object({
  name: z.string().min(2).max(50).trim(),
  organizationId: z.string().min(1),
});

export const updateProjectSchema = z.object({
  name: z.string().min(2).max(50).trim(),
});

export const deleteProjectSchema = z.object({
  confirmation: z.literal("delete project", {
    message: 'Please type "delete project" to confirm',
  }),
});

/** Either non-empty string (set) or explicit `null` (reset to unset). */
export const updateProjectDisplayNameTraitKeySchema = z.object({
  traitKey: z.union([z.string().trim().min(1, "Trait key cannot be empty").max(60, "Max 60 characters"), z.null()]),
});

export type Project = z.infer<typeof projectSchema>;
export type ProjectKey = z.infer<typeof projectKeySchema>;

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
export type DeleteProjectInput = z.infer<typeof deleteProjectSchema>;
export type UpdateProjectDisplayNameTraitKeyInput = z.infer<typeof updateProjectDisplayNameTraitKeySchema>;
