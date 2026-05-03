import { z } from "zod";

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

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
export type DeleteProjectInput = z.infer<typeof deleteProjectSchema>;
export type UpdateProjectDisplayNameTraitKeyInput = z.infer<typeof updateProjectDisplayNameTraitKeySchema>;
