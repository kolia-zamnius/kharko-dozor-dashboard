/**
 * Recipient-side invite. The role union keeps `OWNER` even though new OWNER
 * invites can't be minted — legacy `OWNER` rows persist in the DB and the
 * recipient still sees them. The admin-side `inviteSchema` (organizations)
 * narrows mintable invites to `ADMIN | VIEWER`.
 */

import { z } from "zod";

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

/** Accept/decline POSTs carry no body — `organizationName` rides as variables only so dynamic `meta.successKey` / `successVars` can render "Joined {organizationName}" without an inline `onSuccess`. */
export type InviteActionVariables = {
  inviteId: string;
  organizationName: string;
};

export type UserInvite = z.infer<typeof userInviteSchema>;
export type UserInviteAcceptResponse = z.infer<typeof userInviteAcceptResponseSchema>;
export type UserInviteDeclineResponse = z.infer<typeof userInviteDeclineResponseSchema>;
