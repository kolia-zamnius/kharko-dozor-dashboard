import { withAuth } from "@/app/api/_lib/with-auth";
import { sessionDetailSchema } from "@/api-client/sessions/response-schemas";
import { requireResourceAccess } from "@/server/auth/permissions";
import { prisma } from "@/server/db/client";
import { HttpError } from "@/server/http-error";
import { log } from "@/server/logger";
import { NextResponse } from "next/server";

type Params = { sessionId: string };

/**
 * `GET /api/sessions/[sessionId]` — full session detail for the replay page.
 *
 * VIEWER+ of the owning org.
 *
 * @remarks
 * Returns metadata + `slices[]` (each slice has its own rrweb
 * snapshot; events load per-slice on demand via the sibling
 * `/slices/[i]/events` endpoint). Legacy pre-slice sessions (empty
 * `slices[]`) inline their events so old recordings still play.
 *
 * @see {@link sessionDetailOptions} — client-side consumer.
 */
export const GET = withAuth<Params>(async (req, user, { sessionId }) => {
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: {
      project: { select: { name: true, organizationId: true } },
      trackedUser: { select: { id: true, externalId: true, traits: true } },
      slices: {
        select: {
          id: true,
          index: true,
          reason: true,
          pathname: true,
          url: true,
          viewportWidth: true,
          viewportHeight: true,
          startedAt: true,
          endedAt: true,
          duration: true,
          eventCount: true,
        },
        orderBy: { index: "asc" },
      },
    },
  });

  if (!session) {
    throw new HttpError(404, "Session not found");
  }

  await requireResourceAccess(user.id, user.activeOrganizationId, session.project.organizationId, "VIEWER");

  // Legacy sessions (no slices) inline their events; post-slice sessions stream per-slice.
  const isLegacy = session.slices.length === 0;
  let events: { type: number; timestamp: number; data: unknown }[] = [];
  if (isLegacy) {
    const rawEvents = await prisma.event.findMany({
      where: { sessionId },
      select: { type: true, timestamp: true, data: true },
      orderBy: { timestamp: "asc" },
    });
    events = rawEvents.map((e) => ({ type: e.type, timestamp: Number(e.timestamp), data: e.data }));
  }

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
      events,
      slices: session.slices.map((s) => ({
        id: s.id,
        index: s.index,
        reason: s.reason,
        pathname: s.pathname,
        url: s.url,
        viewportWidth: s.viewportWidth,
        viewportHeight: s.viewportHeight,
        startedAt: s.startedAt.toISOString(),
        endedAt: s.endedAt?.toISOString() ?? null,
        duration: s.duration,
        eventCount: s.eventCount,
      })),
    }),
  );
});

/**
 * `DELETE /api/sessions/[sessionId]` — hard-delete a session (cascades slices + events).
 *
 * ADMIN+ (not OWNER) on purpose — QA / staging cleanup loops stay
 * unblocked without an owner on call. No security upside to tighter
 * gating since sessions are per-project, not governance-tier.
 */
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
