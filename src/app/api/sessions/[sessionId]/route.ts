import { withAuth } from "@/app/api/_lib/with-auth";
import { sessionDetailSchema } from "@/api-client/sessions/response-schemas";
import { requireResourceAccess } from "@/server/auth/permissions";
import { prisma } from "@/server/db/client";
import { HttpError } from "@/server/http-error";
import { log } from "@/server/logger";
import { NextResponse } from "next/server";

type Params = { sessionId: string };

// Detail ships markers inline so the player can render the timeline picker
// before fetching the (large, paginated) event-batch stream from `/events`.
export const GET = withAuth<Params>(async (req, user, { sessionId }) => {
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: {
      project: { select: { name: true, organizationId: true } },
      trackedUser: { select: { id: true, externalId: true, traits: true } },
      markers: {
        select: { timestamp: true, kind: true, data: true },
        orderBy: { timestamp: "asc" },
      },
    },
  });

  if (!session) {
    throw new HttpError(404, "Session not found");
  }

  await requireResourceAccess(user.id, user.activeOrganizationId, session.project.organizationId, "VIEWER");

  return NextResponse.json(
    sessionDetailSchema.parse({
      id: session.id,
      externalId: session.externalId,
      projectId: session.projectId,
      projectName: session.project.name,
      url: session.url,
      userAgent: session.userAgent,
      screenWidth: session.screenWidth,
      screenHeight: session.screenHeight,
      language: session.language,
      duration: session.duration,
      eventCount: session.eventCount,
      startedAt: session.startedAt.toISOString(),
      endedAt: session.endedAt?.toISOString() ?? null,
      createdAt: session.createdAt.toISOString(),
      trackedUserId: session.trackedUser?.id ?? null,
      userId: session.trackedUser?.externalId ?? null,
      userTraits: (session.trackedUser?.traits as SessionTraits | null) ?? null,
      markers: session.markers.map((m) => ({
        timestamp: Number(m.timestamp),
        kind: m.kind,
        data: m.data,
      })),
    }),
  );
});

// ADMIN+ on purpose — QA/staging cleanup loops stay unblocked without an OWNER on call.
// Sessions are per-project, not governance-tier.
export const DELETE = withAuth<Params>(async (req, user, { sessionId }) => {
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    select: { project: { select: { organizationId: true } } },
  });

  if (!session) {
    throw new HttpError(404, "Session not found");
  }

  await requireResourceAccess(user.id, user.activeOrganizationId, session.project.organizationId, "ADMIN");

  await prisma.session.delete({ where: { id: sessionId } });

  log.info("session:delete:ok", {
    sessionId,
    orgId: session.project.organizationId,
    byUserId: user.id,
  });

  return new Response(null, { status: 204 });
});
