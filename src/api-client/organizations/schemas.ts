import { z } from "zod";

export const organizationRoleSchema = z.enum(["OWNER", "ADMIN", "VIEWER"]);
export const organizationTypeSchema = z.enum(["PERSONAL", "TEAM"]);

/** Issuable invite roles — `OWNER` is reserved (transferred via members API, not invites). */
const inviteRoleEnum = z.enum(["ADMIN", "VIEWER"]);
const inviteRoleEnumWithMessage = z.enum(["ADMIN", "VIEWER"], { message: "Role must be Admin or Viewer" });

export const organizationSchema = z.object({
  id: z.string(),
  name: z.string(),
  image: z.string(),
  type: organizationTypeSchema,
  role: organizationRoleSchema,
  membershipId: z.string(),
  memberCount: z.number().int().nonnegative(),
  createdAt: z.string(),
});

export const organizationMemberSchema = z.object({
  id: z.string(),
  role: organizationRoleSchema,
  joinedAt: z.string(),
  user: z.object({
    id: z.string(),
    name: z.string().nullable(),
    email: z.string(),
    image: z.string(),
  }),
});

export const organizationInviteSchema = z.object({
  id: z.string(),
  email: z.string(),
  role: inviteRoleEnum,
  expiresAt: z.string(),
  createdAt: z.string(),
  invitedBy: z.object({
    name: z.string().nullable(),
    email: z.string(),
  }),
});

export const organizationListSchema = z.array(organizationSchema);
export const organizationMemberListSchema = z.array(organizationMemberSchema);
export const organizationInviteListSchema = z.array(organizationInviteSchema);

/** Narrow POST response — full DTO arrives via the mutation's cache invalidation. */
export const organizationCreatedSchema = z.object({
  id: z.string(),
  name: z.string(),
  image: z.string(),
  type: organizationTypeSchema,
});

/** Narrow POST response — full DTO (`expiresAt`, `createdAt`, `invitedBy`) lands via `onSettled` refetch. */
export const organizationInviteCreatedSchema = z.object({
  id: z.string(),
  email: z.string(),
  role: inviteRoleEnum,
});

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
  role: inviteRoleEnumWithMessage,
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
    role: inviteRoleEnumWithMessage,
  }),
  z.object({ action: z.literal("extend") }),
]);

export const deleteOrgSchema = z.object({
  confirmation: z.literal("delete organization", {
    message: 'Please type "delete organization" to confirm',
  }),
});

export type Organization = z.infer<typeof organizationSchema>;
export type OrganizationMember = z.infer<typeof organizationMemberSchema>;
export type OrganizationInvite = z.infer<typeof organizationInviteSchema>;

export type CreateOrgInput = z.infer<typeof createOrgSchema>;
export type UpdateOrgInput = z.infer<typeof updateOrgSchema>;
export type InviteInput = z.infer<typeof inviteSchema>;
export type UpdateInviteInput = z.infer<typeof updateInviteSchema>;
export type DeleteOrgInput = z.infer<typeof deleteOrgSchema>;
