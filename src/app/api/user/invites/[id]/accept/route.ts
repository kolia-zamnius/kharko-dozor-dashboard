import { assertInviteUsableForUser } from "@/app/api/_lib/invite-lifecycle";
import { withAuth } from "@/app/api/_lib/with-auth";
import { userInviteAcceptResponseSchema } from "@/api-client/user-invites/schemas";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/server/db/client";
import { HttpError } from "@/server/http-error";
import { log } from "@/server/logger";
import { NextResponse } from "next/server";

type Params = { id: string };

/**
 * Serializable tx — `Membership` create + invite ACCEPT in one round-trip.
 * Prevents the double-accept race (two tabs/re-click); both `P2002` (unique
 * violation) and `P2034` (serialization conflict) collapse to 409.
 *
 * Invite id is `cuid()` (unguessable) + `assertInviteUsableForUser` enforces
 * status/TTL/email — belt-and-braces against a leaked id.
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

  // Already threw if null — narrowing for TS.
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
    if (err instanceof Prisma.PrismaClientKnownRequestError && (err.code === "P2002" || err.code === "P2034")) {
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
