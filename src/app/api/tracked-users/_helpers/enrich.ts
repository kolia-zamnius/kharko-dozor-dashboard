import "server-only";

import { deriveUserStatus, type UserActivityStatus } from "@/api-client/tracked-users/status";
import { resolveDisplayName } from "@/api-client/tracked-users/resolve-display-name";

/**
 * Raw Prisma row shape consumed by {@link enrichTrackedUser}.
 *
 * @remarks
 * Kept as a plain type (not a `Prisma.X.GetPayload`) so helpers stay
 * Prisma-free at the type level and testable against plain fixtures.
 */
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

/**
 * Final enriched shape returned to the client.
 *
 * @remarks
 * Mirrors one row of `GET /api/tracked-users` — the route just wraps
 * these in `{ data, nextCursor }`.
 */
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
 * Enrich a raw `TrackedUser` row with derived UI fields.
 *
 * @remarks
 * Computes: resolved display name (4-level fallback), activity status,
 * `lastEventAt` (max `session.endedAt`), rolling 7-day active-time sum.
 * Pure — all dependencies come from `ctx`, so every row in a response
 * frames its status against the same wall clock.
 *
 * Why loop sessions in JS instead of aggregating in SQL: the sessions
 * relation is already loaded for other list-page fields, so a separate
 * aggregate query would double the round-trips for no gain.
 *
 * @param row - Raw Prisma row from `GET /api/tracked-users` query.
 * @param ctx - Shared derivation context (project map, wall clock).
 * @returns UI-facing enriched row.
 *
 * @throws {Error} When `row.projectId` has no match in `ctx.projectMap`.
 *   Defensive — the caller already scopes to org projects; this branch
 *   signals a data-shape bug that should surface loudly.
 */
export function enrichTrackedUser(row: RawTrackedUserRow, ctx: EnrichContext): EnrichedTrackedUser {
  const project = ctx.projectMap.get(row.projectId);
  if (!project) {
    throw new Error(`TrackedUser ${row.id} has no matching project in enrich context`);
  }

  const traits = (row.traits as Record<string, unknown>) ?? null;

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
