import { withAuth } from "@/app/api/_lib/with-auth";
import { sessionEventListSchema } from "@/api-client/sessions/response-schemas";
import { requireResourceAccess } from "@/server/auth/permissions";
import { prisma } from "@/server/db/client";
import { HttpError } from "@/server/http-error";
import { NextResponse } from "next/server";

type Params = { sessionId: string; sliceIndex: string };

/**
 * `GET /api/sessions/[sessionId]/slices/[sliceIndex]/events` — rrweb events for one slice.
 *
 * VIEWER+.
 *
 * @remarks
 * Loaded on demand by the replay viewer as the user scrubs into a
 * slice — avoids shipping the full event log upfront for long
 * multi-slice sessions. Events are ordered ascending by timestamp so
 * the Replayer consumes them as a stream without preliminary sort.
 */
export const GET = withAuth<Params>(async (req, user, { sessionId, sliceIndex }) => {
  const idx = parseInt(sliceIndex, 10);
  if (Number.isNaN(idx) || idx < 0) {
    return NextResponse.json({ error: "Invalid slice index" }, { status: 400 });
  }

  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    select: { project: { select: { organizationId: true } } },
  });

  if (!session) {
    throw new HttpError(404, "Session not found");
  }

  await requireResourceAccess(user.id, user.activeOrganizationId, session.project.organizationId, "VIEWER");

  const slice = await prisma.slice.findUnique({
    where: { sessionId_index: { sessionId, index: idx } },
    select: { id: true },
  });

  if (!slice) {
    throw new HttpError(404, "Slice not found");
  }

  const events = await prisma.event.findMany({
    where: { sliceId: slice.id },
    select: { type: true, timestamp: true, data: true },
    orderBy: { timestamp: "asc" },
  });

  return NextResponse.json(
    sessionEventListSchema.parse(
      events.map((e) => ({
        type: e.type,
        timestamp: Number(e.timestamp),
        data: e.data,
      })),
    ),
  );
});
