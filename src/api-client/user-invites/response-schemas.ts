import { z } from "zod";

/**
 * Recipient-side invite shape keeps the full role union including `OWNER` —
 * legacy rows with `OWNER` role remain in the DB and the recipient still sees
 * them, even though new `OWNER` invites can't be minted (admin-side
 * `inviteSchema` narrows to `ADMIN | VIEWER`).
 */

export const userInviteSchema = z.object({
  id: z.string(),
  role: z.enum(["OWNER", "ADMIN", "VIEWER"]),
  expiresAt: z.string(),
  createdAt: z.string(),
  organization: z.object({
    id: z.string(),
    name: z.string(),
    image: z.string(),
  }),
  invitedBy: z.object({
    name: z.string().nullable(),
    email: z.string(),
  }),
});

export const userInviteListSchema = z.array(userInviteSchema);

/** `organizationName` for the dynamic "Joined X" toast; `organizationId` for the orgs-list refetch marker. */
export const userInviteAcceptResponseSchema = z.object({
  organizationId: z.string(),
  organizationName: z.string(),
});

/** Trivial positive ack — schema'd for consistency so accidental shape drift 500s here, not at the client. */
export const userInviteDeclineResponseSchema = z.object({
  ok: z.literal(true),
});
