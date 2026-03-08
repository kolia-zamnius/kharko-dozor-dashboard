import "server-only";

import { prisma } from "@/server/db/client";
import type { IngestEvent, IngestMetadata } from "./parse-body";

/**
 * Minimum session info needed by downstream slice + event helpers.
 *
 * @remarks
 * Prisma's default select is wider than we need — narrowing keeps
 * downstream helpers honest about what they actually depend on.
 */
export type UpsertedSession = {
  readonly id: string;
  readonly startedAt: Date;
  readonly trackedUserId: string | null;
};

/**
 * Idempotently upsert the `Session` row + link the identified `TrackedUser`.
 *
 * @remarks
 * First batch creates the Session with full metadata; subsequent
 * batches only bump `endedAt` + `eventCount`. Empty batches (metadata-
 * only pings) skip timestamp updates so a `Date.now()` placeholder
 * can't stomp real event bounds.
 *
 * `TrackedUser` upsert runs only when the SDK reported identity — the
 * link is written back on the Session in the same transaction so
 * every subsequent query resolves the user without a second lookup.
 *
 * @param projectId - Project that the public key authenticated against.
 * @param externalId - Session id minted by the SDK.
 * @param events - Events from this batch (may be empty for metadata pings).
 * @param metadata - SDK-supplied session metadata + optional identity.
 * @returns Narrow session info for downstream slice / event helpers.
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
    const traitsJson = traits ? (traits as Record<string, unknown> & object) : undefined;
    const trackedUser = await prisma.trackedUser.upsert({
      where: { projectId_externalId: { projectId, externalId: userId } },
      create: { externalId: userId, projectId, traits: traitsJson },
      update: { traits: traitsJson },
      select: { id: true },
    });
    sessionUpdate.trackedUserId = trackedUser.id;
  }

  await prisma.session.update({ where: { id: session.id }, data: sessionUpdate });

  return {
    id: session.id,
    startedAt: session.startedAt,
    trackedUserId: sessionUpdate.trackedUserId ?? session.trackedUserId,
  };
}
