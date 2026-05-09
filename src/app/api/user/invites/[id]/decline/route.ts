import { assertInviteUsableForUser } from "@/app/api/_lib/invite-lifecycle";
import { withAuth } from "@/app/api/_lib/with-auth";
import { userInviteDeclineResponseSchema } from "@/api-client/user-invites/schemas";
import { prisma } from "@/server/db/client";
import { HttpError } from "@/server/http-error";
import { log } from "@/server/logger";
import { NextResponse } from "next/server";

type Params = { id: string };

/**
 * Hard-delete (no `DECLINED` enum) — admin list filters PENDING anyway, the
 * extra status would buy nothing. Re-send is the recovery path.
 */
export const POST = withAuth<Params>(async (_req, user, { id }) => {
  const invite = await prisma.invite.findUnique({
    where: { id },
    select: { id: true, email: true, status: true, expiresAt: true },
  });

  await assertInviteUsableForUser(invite, user.email);

  // Narrowing — the helper throws on null.
  if (!invite) throw new HttpError(404, "This invitation is invalid or has already been used.");

  await prisma.invite.delete({ where: { id: invite.id } });

  log.info("user:invite:decline:ok", { inviteId: invite.id, userId: user.id });

  return NextResponse.json(userInviteDeclineResponseSchema.parse({ ok: true }));
});
