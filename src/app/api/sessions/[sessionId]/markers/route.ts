import { NextResponse } from "next/server";
import { z } from "zod";

import { withAuth } from "@/app/api/_lib/with-auth";
import { sessionMarkersResponseSchema } from "@/api-client/sessions/response-schemas";
import { requireResourceAccess } from "@/server/auth/permissions";
import { prisma } from "@/server/db/client";
import { HttpError } from "@/server/http-error";

type Params = { sessionId: string };

// Closed at the schema boundary — an unknown `?kind=foo` is a 400, not a
// silent empty result that looks indistinguishable from "no markers".
const queryParamsSchema = z.object({
  kind: z.enum(["url", "identity"]).optional(),
});

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
  const kindParam = url.searchParams.get("kind");
  const { kind } = queryParamsSchema.parse(kindParam !== null && kindParam !== "" ? { kind: kindParam } : {});

  const markers = await prisma.marker.findMany({
    where: { sessionId, ...(kind ? { kind } : {}) },
    select: { timestamp: true, kind: true, data: true },
    orderBy: { timestamp: "asc" },
  });

  return NextResponse.json(
    sessionMarkersResponseSchema.parse({
      markers: markers.map((m) => ({ timestamp: Number(m.timestamp), kind: m.kind, data: m.data })),
    }),
    // Markers extend live as the SDK ships more batches — same no-cache
    // contract as the events endpoint, same Reload-button refetch flow.
    { headers: { "Cache-Control": "no-store" } },
  );
});
