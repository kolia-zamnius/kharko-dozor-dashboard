import "server-only";

import { prisma } from "@/server/db/client";
import { log } from "@/server/logger";
import type { IngestEvent, IngestMetadata } from "./parse-body";

/** Narrow — keeps downstream helpers honest about what they depend on. */
export type UpsertedSession = {
  readonly id: string;
  readonly startedAt: Date;
  readonly trackedUserId: string | null;
};

/**
 * First batch creates with full metadata; subsequent batches bump only
 * `endedAt`/`eventCount`. Empty batches (metadata-only pings) skip timestamp
 * updates so a `Date.now()` placeholder can't stomp real event bounds.
 */
export async function upsertSessionAndLinkTrackedUser(
  projectId: string,
  externalId: string,
  events: readonly IngestEvent[],
  metadata: IngestMetadata,
): Promise<UpsertedSession> {
  const hasEvents = events.length > 0;
  const timestamps = hasEvents ? events.map((e) => e.timestamp) : [];
  const minTimestamp = hasEvents ? Math.min(...timestamps) : Date.now();
  const maxTimestamp = hasEvents ? Math.max(...timestamps) : Date.now();

  const session = await prisma.session.upsert({
    where: { projectId_externalId: { projectId, externalId } },
    create: {
      externalId,
      projectId,
      url: metadata?.url,
      userAgent: metadata?.userAgent,
      screenWidth: metadata?.screenWidth,
      screenHeight: metadata?.screenHeight,
      language: metadata?.language,
      startedAt: new Date(minTimestamp),
      endedAt: new Date(maxTimestamp),
      eventCount: events.length,
      duration: Math.round((maxTimestamp - minTimestamp) / 1000),
    },
    update: hasEvents ? { endedAt: new Date(maxTimestamp), eventCount: { increment: events.length } } : {},
    select: { id: true, startedAt: true, trackedUserId: true },
  });

  const durationSeconds = hasEvents ? Math.round((maxTimestamp - session.startedAt.getTime()) / 1000) : undefined;
  const sessionUpdate: { duration?: number; trackedUserId?: string } = { duration: durationSeconds };

  if (metadata?.userIdentity) {
    const { userId, traits } = metadata.userIdentity;
    const traitsJson = traits ? (traits as SessionTraits & object) : undefined;
    const trackedUser = await prisma.trackedUser.upsert({
      where: { projectId_externalId: { projectId, externalId: userId } },
      create: { externalId: userId, projectId, traits: traitsJson },
      update: { traits: traitsJson },
      select: { id: true },
    });
    sessionUpdate.trackedUserId = trackedUser.id;
    log.debug("ingest:tracked_user:linked", {
      projectId,
      sessionId: session.id,
      trackedUserId: trackedUser.id,
      externalUserId: userId,
    });
  }

  await prisma.session.update({ where: { id: session.id }, data: sessionUpdate });

  return {
    id: session.id,
    startedAt: session.startedAt,
    trackedUserId: sessionUpdate.trackedUserId ?? session.trackedUserId,
  };
}
