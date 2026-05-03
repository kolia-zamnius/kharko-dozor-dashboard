import { z } from "zod";

export const createOrgSchema = z.object({
  name: z.string().min(2).max(50).trim(),
});

export const updateOrgSchema = z.object({
  name: z.string().min(2).max(50).trim().optional(),
  regenerateAvatar: z.boolean().optional(),
});

/** OWNER invites are not issuable — narrowed to `ADMIN | VIEWER`. */
export const inviteSchema = z.object({
  email: z.email(),
  role: z.enum(["ADMIN", "VIEWER"], { message: "Role must be Admin or Viewer" }),
});

/**
 * Discriminated union (not a partial object) so the server branches on `action`
 * without guessing intent from field presence. Each branch carries its own
 * `meta.successKey` ("Role updated" vs "Invite extended") at the mutation site,
 * and a future "resend email" plugs in as another discriminant without breaking
 * existing consumers.
 */
export const updateInviteSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("change-role"),
    role: z.enum(["ADMIN", "VIEWER"], { message: "Role must be Admin or Viewer" }),
  }),
  z.object({ action: z.literal("extend") }),
]);

export const deleteOrgSchema = z.object({
  confirmation: z.literal("delete organization", {
    message: 'Please type "delete organization" to confirm',
  }),
});

export type CreateOrgInput = z.infer<typeof createOrgSchema>;
export type UpdateOrgInput = z.infer<typeof updateOrgSchema>;
export type InviteInput = z.infer<typeof inviteSchema>;
export type UpdateInviteInput = z.infer<typeof updateInviteSchema>;
export type DeleteOrgInput = z.infer<typeof deleteOrgSchema>;
