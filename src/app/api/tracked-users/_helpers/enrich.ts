import "server-only";

import { deriveUserStatus, type UserActivityStatus } from "@/api-client/tracked-users/domain";
import { resolveDisplayName } from "@/api-client/tracked-users/domain";

/** Plain type (not `Prisma.X.GetPayload`) — keeps the helper Prisma-free at the type level + testable against plain fixtures. */
export type RawTrackedUserRow = {
  readonly id: string;
  readonly externalId: string;
  readonly projectId: string;
  readonly traits: unknown;
  readonly customName: string | null;
  readonly displayNameTraitKey: string | null;
  readonly createdAt: Date;
  readonly _count: { readonly sessions: number };
  readonly sessions: ReadonlyArray<{
    readonly endedAt: Date | null;
    readonly duration: number;
    readonly startedAt: Date;
  }>;
};

export type ProjectMetadata = {
  readonly id: string;
  readonly name: string;
  readonly defaultDisplayNameTraitKey: string | null;
};

export type EnrichContext = {
  readonly projectMap: ReadonlyMap<string, ProjectMetadata>;
  readonly sevenDaysAgo: Date;
  readonly now: Date;
};

/** Mirrors one row of `GET /api/tracked-users` — the route wraps these in `{ data, nextCursor }`. */
export type EnrichedTrackedUser = {
  readonly id: string;
  readonly externalId: string;
  readonly displayName: string;
  readonly projectId: string;
  readonly projectName: string;
  readonly traits: Record<string, unknown> | null;
  readonly sessionCount: number;
  readonly lastEventAt: string | null;
  readonly status: UserActivityStatus;
  readonly activeTime7d: number;
  readonly createdAt: string;
};

/**
 * Pure — `ctx` carries the wall clock so every row in a response frames its
 * status against the same instant. JS loop over sessions (not SQL aggregate)
 * because the relation is already loaded for other list fields — separate
 * aggregate would double round-trips for no gain.
 */
export function enrichTrackedUser(row: RawTrackedUserRow, ctx: EnrichContext): EnrichedTrackedUser {
  const project = ctx.projectMap.get(row.projectId);
  if (!project) {
    throw new Error(`TrackedUser ${row.id} has no matching project in enrich context`);
  }

  const traits = (row.traits as SessionTraits | null) ?? null;

  let lastEventAt: Date | null = null;
  let activeTime7d = 0;
  for (const session of row.sessions) {
    if (session.endedAt && (!lastEventAt || session.endedAt > lastEventAt)) {
      lastEventAt = session.endedAt;
    }
    if (session.startedAt >= ctx.sevenDaysAgo) {
      activeTime7d += session.duration;
    }
  }

  const displayName = resolveDisplayName({
    externalId: row.externalId,
    traits,
    customName: row.customName,
    displayNameTraitKey: row.displayNameTraitKey,
    projectDefaultTraitKey: project.defaultDisplayNameTraitKey,
  });

  return {
    id: row.id,
    externalId: row.externalId,
    displayName,
    projectId: row.projectId,
    projectName: project.name,
    traits,
    sessionCount: row._count.sessions,
    lastEventAt: lastEventAt?.toISOString() ?? null,
    status: deriveUserStatus(lastEventAt, ctx.now),
    activeTime7d,
    createdAt: row.createdAt.toISOString(),
  };
}
