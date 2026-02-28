import { z } from "zod";

/**
 * Response DTO schemas for the `organizations` feature.
 *
 * @remarks
 * Twin of `validators.ts` — inputs vs outputs. Every JSON-returning
 * route in `src/app/api/organizations/**` parses its payload through
 * one of these before `NextResponse.json`, so Prisma-select drift,
 * accidentally-exposed internal fields, or timestamp forgotten-as-Date
 * all surface as explicit 500s instead of silent leaks.
 *
 * Role shapes:
 *   - `Organization.role` is the full tri-state — any membership kind
 *     is valid for list display.
 *   - `OrganizationInvite.role` narrows to `ADMIN | VIEWER` because
 *     OWNER invites are not issuable (see `inviteSchema`). The schema
 *     enforces that narrowing at the wire layer — an accidental
 *     `OWNER` leak from a legacy row would 500 here instead of
 *     reaching the client.
 *
 * @see src/api-client/organizations/validators.ts — request-side schemas.
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
  // Narrowed from full role union — OWNER invites are not issuable.
  role: z.enum(["ADMIN", "VIEWER"]),
  expiresAt: z.string(),
  createdAt: z.string(),
  invitedBy: z.object({
    name: z.string().nullable(),
    email: z.string(),
  }),
});

// List-shape helpers — exported so route handlers can
// `organizationListSchema.parse(rows)` instead of re-wrapping every time.
export const organizationListSchema = z.array(organizationSchema);
export const organizationMemberListSchema = z.array(organizationMemberSchema);
export const organizationInviteListSchema = z.array(organizationInviteSchema);

/**
 * Narrow response of `POST /api/organizations` — returns just enough
 * for the client to navigate to the new org. The full DTO fields
 * (`role`, `membershipId`, `memberCount`, `createdAt`) arrive on the
 * next `GET /api/organizations` refetch that `useCreateOrgMutation`
 * triggers via cache invalidation.
 */
export const organizationCreatedSchema = z.object({
  id: z.string(),
  name: z.string(),
  image: z.string(),
  type: organizationTypeSchema,
});

/**
 * Narrow response of `POST /api/organizations/[orgId]/invites` — the
 * client only needs the new invite id + echoed email/role for the
 * optimistic table update. Full DTO (`expiresAt`, `createdAt`,
 * `invitedBy`) lands via the `onSettled` refetch.
 */
export const organizationInviteCreatedSchema = z.object({
  id: z.string(),
  email: z.string(),
  role: z.enum(["ADMIN", "VIEWER"]),
});
