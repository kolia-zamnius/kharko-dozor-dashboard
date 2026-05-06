import { NextResponse } from "next/server";

import { withAuth } from "@/app/api/_lib/with-auth";
import { sessionMarkersResponseSchema } from "@/api-client/sessions/response-schemas";
import { requireResourceAccess } from "@/server/auth/permissions";
import { prisma } from "@/server/db/client";
import { HttpError } from "@/server/http-error";

type Params = { sessionId: string };

export const GET = withAuth<Params>(async (req, user, { sessionId }) => {
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    select: { project: { select: { organizationId: true } } },
  });

  if (!session) {
    throw new HttpError(404, "Session not found");
  }

  await requireResourceAccess(user.id, user.activeOrganizationId, session.project.organizationId, "VIEWER");

  const url = new URL(req.url);
  const kindFilter = url.searchParams.get("kind");

  const markers = await prisma.marker.findMany({
    where: { sessionId, ...(kindFilter ? { kind: kindFilter } : {}) },
    select: { timestamp: true, kind: true, data: true },
    orderBy: { timestamp: "asc" },
  });

  return NextResponse.json(
    sessionMarkersResponseSchema.parse({
      markers: markers.map((m) => ({ timestamp: Number(m.timestamp), kind: m.kind, data: m.data })),
    }),
  );
});
