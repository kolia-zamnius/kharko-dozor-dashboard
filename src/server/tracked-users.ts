import "server-only";

import { trackedUserDetailSchema } from "@/api-client/tracked-users/response-schemas";
import type { TrackedUserDetail } from "@/api-client/tracked-users/types";
import { deriveUserStatus } from "@/api-client/tracked-users/status";
import { resolveDisplayName } from "@/api-client/tracked-users/resolve-display-name";
import { SEVEN_DAYS_MS } from "@/lib/time";
import { requireResourceAccess } from "@/server/auth/permissions";
import { prisma } from "@/server/db/client";
import { REAL_SESSION_FILTER } from "@/server/sessions/real-session-filter";
import type { TrackedUserId, UserId } from "@/types/ids";

/**
 * Isomorphic loader — same payload shape for the API route and the RSC prefetch
 * for TanStack hydration. Field drift here invalidates the cache hand-off, so the
 * output is parsed through `trackedUserDetailSchema` to fail fast on Prisma-select
 * drift. `displayName` is resolved here (not in callers) so clients don't reimplement
 * the fallback chain; raw source fields are echoed back so the edit modal can pre-fill.
 *
 * @throws {HttpError} 400 — no active organization on the requester.
 * @throws {HttpError} 404 — tracked user lives in a different org than the
 *   requester's active one (opaque, never 403).
 * @throws {HttpError} 403 — membership check failed.
 */
export async function loadTrackedUserDetail(
  userId: TrackedUserId,
  requesterId: UserId,
  requesterActiveOrgId: string | null | undefined,
): Promise<TrackedUserDetail | null> {
  const trackedUser = await prisma.trackedUser.findUnique({
    where: { id: userId },
    include: {
      project: {
        select: {
          name: true,
          organizationId: true,
          defaultDisplayNameTraitKey: true,
        },
      },
      _count: { select: { sessions: { where: REAL_SESSION_FILTER } } },
      sessions: {
        where: REAL_SESSION_FILTER,
        select: { endedAt: true, duration: true, startedAt: true },
      },
    },
  });

  if (!trackedUser) return null;

  await requireResourceAccess(requesterId, requesterActiveOrgId, trackedUser.project.organizationId, "VIEWER");

  const traits = (trackedUser.traits as SessionTraits | null) ?? null;
  const projectDisplayNameTraitKey = trackedUser.project.defaultDisplayNameTraitKey ?? null;

  const displayName = resolveDisplayName({
    externalId: trackedUser.externalId,
    traits,
    customName: trackedUser.customName,
    displayNameTraitKey: trackedUser.displayNameTraitKey,
    projectDefaultTraitKey: projectDisplayNameTraitKey,
  });

  // Activity rollup mirrors the list-route logic in `api/tracked-users/_helpers/enrich.ts`.
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - SEVEN_DAYS_MS);
  let lastEventAt: Date | null = null;
  let activeTime7d = 0;

  for (const session of trackedUser.sessions) {
    if (session.endedAt && (!lastEventAt || session.endedAt > lastEventAt)) {
      lastEventAt = session.endedAt;
    }
    if (session.startedAt >= sevenDaysAgo) {
      activeTime7d += session.duration;
    }
  }

  const status = deriveUserStatus(lastEventAt, now);

  return trackedUserDetailSchema.parse({
    id: trackedUser.id,
    externalId: trackedUser.externalId,
    displayName,
    projectId: trackedUser.projectId,
    projectName: trackedUser.project.name,
    traits,
    sessionCount: trackedUser._count.sessions,
    lastEventAt: lastEventAt?.toISOString() ?? null,
    status,
    activeTime7d,
    createdAt: trackedUser.createdAt.toISOString(),
    customName: trackedUser.customName,
    displayNameTraitKey: trackedUser.displayNameTraitKey,
    projectDisplayNameTraitKey,
  });
}
