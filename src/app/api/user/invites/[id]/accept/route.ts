import { assertInviteUsableForUser } from "@/app/api/_lib/invite-lifecycle";
import { withAuth } from "@/app/api/_lib/with-auth";
import { userInviteAcceptResponseSchema } from "@/api-client/user-invites/response-schemas";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/server/db/client";
import { HttpError } from "@/server/http-error";
import { log } from "@/server/logger";
import { NextResponse } from "next/server";

type Params = { id: string };

/**
 * `POST /api/user/invites/[id]/accept` — claim a pending invite.
 *
 * @remarks
 * Atomic Serializable transaction: `Membership` create AND invite
 * `status → ACCEPTED` in one round-trip. The Serializable isolation
 * level prevents the double-accept race (two tabs / a re-click) where
 * read-committed lets both transactions see PENDING and the second
 * commit hits the `(userId, organizationId)` unique constraint as a
 * 500. Both `P2002` (unique violation) and `P2034` (serialization
 * conflict) collapse to a clean `409 already accepted`.
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

  try {
    await prisma.$transaction(
      async (tx) => {
        await tx.membership.create({
          data: { userId: user.id, organizationId: invite.organizationId, role: invite.role },
        });
        await tx.invite.update({ where: { id: invite.id }, data: { status: "ACCEPTED" } });
      },
      { isolationLevel: "Serializable" },
    );
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      (err.code === "P2002" || err.code === "P2034")
    ) {
      log.debug("user:invite:accept:race", {
        inviteId: invite.id,
        orgId: invite.organizationId,
        userId: user.id,
        code: err.code,
      });
      throw new HttpError(409, "This invitation has already been accepted.");
    }
    throw err;
  }

  log.info("user:invite:accept:ok", {
    inviteId: invite.id,
    orgId: invite.organizationId,
    role: invite.role,
    userId: user.id,
  });

  return NextResponse.json(
    userInviteAcceptResponseSchema.parse({
      organizationId: invite.organizationId,
      organizationName: invite.organization.name,
    }),
  );
});
