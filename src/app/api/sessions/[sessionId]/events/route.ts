import { NextResponse } from "next/server";

import { withAuth } from "@/app/api/_lib/with-auth";
import { sessionEventsResponseSchema } from "@/api-client/sessions/response-schemas";
import { requireResourceAccess } from "@/server/auth/permissions";
import { prisma } from "@/server/db/client";
import { HttpError } from "@/server/http-error";

type Params = { sessionId: string };

// All batches in a single response — first cut. The client decompresses each
// (`data` is base64-gzip), concatenates the events arrays, sorts by timestamp.
// Cursor is left in the schema for forward-compat once we hit a session that
// genuinely needs paging.
//
// `Number(BigInt)` collapse on the timestamps is safe: rrweb stamps Unix-ms,
// JS Number holds integer precision through 2^53 — that's year 287,396 AD.
export const GET = withAuth<Params>(async (req, user, { sessionId }) => {
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    select: { project: { select: { organizationId: true } } },
  });

  if (!session) {
    throw new HttpError(404, "Session not found");
  }

  await requireResourceAccess(user.id, user.activeOrganizationId, session.project.organizationId, "VIEWER");

  const batches = await prisma.eventBatch.findMany({
    where: { sessionId },
    select: { id: true, firstTimestamp: true, lastTimestamp: true, eventCount: true, data: true },
    orderBy: [{ firstTimestamp: "asc" }, { id: "asc" }],
  });

  return NextResponse.json(
    sessionEventsResponseSchema.parse({
      batches: batches.map((b) => ({
        id: b.id,
        firstTimestamp: Number(b.firstTimestamp),
        lastTimestamp: Number(b.lastTimestamp),
        eventCount: b.eventCount,
        data: Buffer.from(b.data).toString("base64"),
      })),
      nextCursor: null,
    }),
    // Live sessions keep accepting batches until `endedAt` flips — the orange
    // Reload button is what triggers a refetch, so any intermediate caching
    // would mask new events between renders.
    { headers: { "Cache-Control": "no-store" } },
  );
});
