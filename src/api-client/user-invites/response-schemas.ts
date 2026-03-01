import { z } from "zod";

/**
 * Response DTO schemas for the `user-invites` feature — powers the
 * "My invitations" block on `/settings/organizations` plus the
 * accept/decline confirmation bodies.
 *
 * @remarks
 * Three routes back this feature:
 *   - `GET /api/user/invites` → {@link userInviteListSchema}
 *   - `POST /api/user/invites/[id]/accept` →
 *      {@link userInviteAcceptResponseSchema}
 *   - `POST /api/user/invites/[id]/decline` →
 *      {@link userInviteDeclineResponseSchema}
 *
 * Unlike `OrganizationInvite` (admin-side list), user-side invites
 * keep the full role enum including `OWNER` — legacy rows with an
 * OWNER role remain in the DB and the recipient still sees them in
 * their list, even though new invites can't be minted at that role.
 *
 * @see src/app/api/user/invites/route.ts — list route handler.
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

/**
 * Response of `POST /api/user/invites/[id]/accept` — the client uses
 * `organizationName` for the dynamic success toast ("Joined X") and
 * `organizationId` so the invalidate-refetch of the orgs list has a
 * marker for the row that just appeared.
 */
export const userInviteAcceptResponseSchema = z.object({
  organizationId: z.string(),
  organizationName: z.string(),
});

/**
 * Response of `POST /api/user/invites/[id]/decline` — trivial
 * positive ack. The client's optimistic mutation removes the row
 * from the cache on `onMutate` so the body is read purely to
 * satisfy the fetch boundary. Schema'd for consistency with the
 * rest of the surface — a silent shape drift (accidentally returning
 * the deleted row, etc.) now 500s here before it touches the client.
 */
export const userInviteDeclineResponseSchema = z.object({
  ok: z.literal(true),
});
