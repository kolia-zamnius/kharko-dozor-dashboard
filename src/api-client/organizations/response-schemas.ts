import { z } from "zod";

/**
 * Output DTOs — every JSON-returning org route parses through one of these before
 * `NextResponse.json`. Prisma-select drift, accidentally exposed internals, or a
 * forgotten Date→string conversion all surface as 500s instead of silent leaks.
 *
 * `OrganizationInvite.role` is narrowed to `ADMIN | VIEWER` — a legacy `OWNER`-roled
 * row leaking into the wire would 500 here, not reach the client.
 */

export const organizationRoleSchema = z.enum(["OWNER", "ADMIN", "VIEWER"]);
export const organizationTypeSchema = z.enum(["PERSONAL", "TEAM"]);

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
  role: z.enum(["ADMIN", "VIEWER"]),
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
  role: z.enum(["ADMIN", "VIEWER"]),
});
