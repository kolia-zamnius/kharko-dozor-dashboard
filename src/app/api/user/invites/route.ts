import { expireStaleInvites } from "@/app/api/_lib/invite-lifecycle";
import { withAuth } from "@/app/api/_lib/with-auth";
import { userInviteListSchema } from "@/api-client/user-invites/response-schemas";
import { prisma } from "@/server/db/client";
import { NextResponse } from "next/server";

/**
 * `GET /api/user/invites` — list pending invites addressed to the caller's email.
 *
 * @remarks
 * Lazy expiry: any row whose `expiresAt` has passed is filtered out
 * AND status-flipped to `EXPIRED` in the background via
 * {@link expireStaleInvites}. The cron still hard-deletes past-TTL
 * rows overnight; this keeps the schema clean between runs without an
 * extra scheduled job.
 *
 * @see {@link userInvitesOptions} — client-side consumer.
 */
export const GET = withAuth(async (_req, user) => {
  const now = new Date();

  const invites = await prisma.invite.findMany({
    where: { email: user.email, status: "PENDING" },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      role: true,
      expiresAt: true,
      createdAt: true,
      organization: { select: { id: true, name: true, image: true } },
      invitedBy: { select: { name: true, email: true } },
    },
  });

  const live: typeof invites = [];
  const expiredIds: string[] = [];
  for (const invite of invites) {
    if (invite.expiresAt < now) expiredIds.push(invite.id);
    else live.push(invite);
  }

  expireStaleInvites(expiredIds);

  return NextResponse.json(
    userInviteListSchema.parse(
      live.map((i) => ({
        id: i.id,
        role: i.role,
        expiresAt: i.expiresAt.toISOString(),
        createdAt: i.createdAt.toISOString(),
        organization: i.organization,
        invitedBy: i.invitedBy,
      })),
    ),
  );
});
