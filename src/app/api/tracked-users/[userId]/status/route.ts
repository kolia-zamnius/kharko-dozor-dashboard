import { withAuth } from "@/app/api/_lib/with-auth";
import { ONLINE_THRESHOLD_MS } from "@/api-client/tracked-users/domain";
import { userStatusSchema } from "@/api-client/tracked-users/response-schemas";
import { requireResourceAccess } from "@/server/auth/permissions";
import { prisma } from "@/server/db/client";
import { HttpError } from "@/server/http-error";
import { NextResponse } from "next/server";

type Params = { userId: string };

/**
 * `MAX(Session.endedAt)` on the indexed `trackedUserId`. Session is bumped on
 * every ingest batch — scanning Event would be orders of magnitude larger.
 */
export const GET = withAuth<Params>(async (_req, user, { userId }) => {
  const trackedUser = await prisma.trackedUser.findUnique({
    where: { id: userId },
    select: { id: true, project: { select: { organizationId: true } } },
  });

  if (!trackedUser) {
    throw new HttpError(404, "User not found");
  }

  await requireResourceAccess(user.id, user.activeOrganizationId, trackedUser.project.organizationId, "VIEWER");

  const agg = await prisma.session.aggregate({
    where: { trackedUserId: trackedUser.id },
    _max: { endedAt: true },
  });

  const lastEventAt = agg._max.endedAt;
  const online = lastEventAt !== null && Date.now() - lastEventAt.getTime() <= ONLINE_THRESHOLD_MS;

  return NextResponse.json(
    userStatusSchema.parse({
      online,
      lastEventAt: lastEventAt?.toISOString() ?? null,
    }),
    { headers: { "Cache-Control": "no-store" } },
  );
});
