import "server-only";

import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { log } from "@/server/logger";
import type { IngestEvent, IngestMetadata } from "./parse-body";

type DbClient = PrismaClient | Prisma.TransactionClient;

export type UpsertedSession = {
  readonly id: string;
  readonly startedAt: Date;
  readonly trackedUserId: string | null;
  /** True only on the call that inserted the row — caller uses this to seed the initial url-marker. */
  readonly wasCreated: boolean;
};

/**
 * First batch creates the row with full bounds; subsequent batches recompute
 * `startedAt`/`endedAt`/`duration` atomically via `LEAST` / `GREATEST` so a
 * delayed out-of-order batch can never shrink an already-extended window.
 * Empty batches (metadata-only pings) skip timestamp updates so a `Date.now()`
 * placeholder can't stomp real event bounds.
 */
export async function upsertSessionAndLinkTrackedUser(
  tx: DbClient,
  projectId: string,
  externalId: string,
  events: readonly IngestEvent[],
  metadata: IngestMetadata,
): Promise<UpsertedSession> {
  const hasEvents = events.length > 0;
  let minTimestamp = Date.now();
  let maxTimestamp = minTimestamp;
  if (hasEvents) {
    minTimestamp = events[0]!.timestamp;
    maxTimestamp = events[0]!.timestamp;
    for (const e of events) {
      if (e.timestamp < minTimestamp) minTimestamp = e.timestamp;
      if (e.timestamp > maxTimestamp) maxTimestamp = e.timestamp;
    }
  }

  const existing = await tx.session.findUnique({
    where: { projectId_externalId: { projectId, externalId } },
    select: { id: true },
  });
  const wasCreated = existing === null;

  const session = await tx.session.upsert({
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
    // Empty on purpose — the atomic GREATEST/LEAST repair below owns the update path.
    update: {},
    select: { id: true, startedAt: true, trackedUserId: true },
  });

  if (!wasCreated && hasEvents) {
    const minDate = new Date(minTimestamp);
    const maxDate = new Date(maxTimestamp);
    await tx.$executeRaw`
      UPDATE "Session"
      SET "startedAt"  = LEAST("startedAt", ${minDate}::timestamp),
          "endedAt"    = GREATEST("endedAt", ${maxDate}::timestamp),
          "eventCount" = "eventCount" + ${events.length},
          "duration"   = ROUND(EXTRACT(EPOCH FROM (
                            GREATEST("endedAt", ${maxDate}::timestamp) - LEAST("startedAt", ${minDate}::timestamp)
                          ))::numeric)::int
      WHERE id = ${session.id}
    `;
  }

  let trackedUserId: string | null = session.trackedUserId;

  if (metadata?.userIdentity) {
    const { userId, traits } = metadata.userIdentity;
    const traitsJson = traits ? (traits as SessionTraits & object) : undefined;
    const trackedUser = await tx.trackedUser.upsert({
      where: { projectId_externalId: { projectId, externalId: userId } },
      create: { externalId: userId, projectId, traits: traitsJson },
      update: { traits: traitsJson },
      select: { id: true },
    });
    trackedUserId = trackedUser.id;
    await tx.session.update({ where: { id: session.id }, data: { trackedUserId: trackedUser.id } });
    log.debug("ingest:tracked_user:linked", {
      projectId,
      sessionId: session.id,
      trackedUserId: trackedUser.id,
      externalUserId: userId,
    });
  }

  return {
    id: session.id,
    startedAt: session.startedAt,
    trackedUserId,
    wasCreated,
  };
}
