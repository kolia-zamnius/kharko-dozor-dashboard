import { assertInviteUsableForUser } from "@/app/api/_lib/invite-lifecycle";
import { withAuth } from "@/app/api/_lib/with-auth";
import { userInviteAcceptResponseSchema } from "@/api-client/user-invites/response-schemas";
import { prisma } from "@/server/db/client";
import { HttpError } from "@/server/http-error";
import { NextResponse } from "next/server";

type Params = { id: string };

/**
 * `POST /api/user/invites/[id]/accept` — claim a pending invite.
 *
 * @remarks
 * Atomic transaction: `Membership` create AND invite `status →
 * ACCEPTED` in one round-trip. A crash between the two writes would
 * otherwise leave a dangling PENDING row for a user who already has
 * membership.
 *
 * Authorization layers: `withAuth` establishes the user;
 * {@link assertInviteUsableForUser} enforces status / TTL / email
 * match. The invite id is a Prisma `cuid()` (unguessable) + the email
 * guard belt-and-braces against a leaked id.
 */
export const POST = withAuth<Params>(async (_req, user, { id }) => {
  const invite = await prisma.invite.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      role: true,
      status: true,
      expiresAt: true,
      organizationId: true,
      organization: { select: { name: true } },
    },
  });

  await assertInviteUsableForUser(invite, user.email);

  // `assertInviteUsableForUser` throws on null — narrowing for TS.
  if (!invite) throw new HttpError(404, "This invitation is invalid or has already been used.");

  await prisma.$transaction([
    prisma.membership.create({
      data: { userId: user.id, organizationId: invite.organizationId, role: invite.role },
    }),
    prisma.invite.update({ where: { id: invite.id }, data: { status: "ACCEPTED" } }),
  ]);

  return NextResponse.json(
    userInviteAcceptResponseSchema.parse({
      organizationId: invite.organizationId,
      organizationName: invite.organization.name,
    }),
  );
});
