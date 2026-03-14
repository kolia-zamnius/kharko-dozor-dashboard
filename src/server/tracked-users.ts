import "server-only";

import { trackedUserDetailSchema } from "@/api-client/tracked-users/response-schemas";
import type { TrackedUserDetail } from "@/api-client/tracked-users/types";
import { deriveUserStatus } from "@/api-client/tracked-users/status";
import { resolveDisplayName } from "@/api-client/tracked-users/resolve-display-name";
import { SEVEN_DAYS_MS } from "@/lib/time";
import { requireMember } from "@/server/auth/permissions";
import { prisma } from "@/server/db/client";
import type { TrackedUserId, UserId } from "@/types/ids";

/**
 * Load a tracked user with permission check, `displayName` resolution,
 * and 7-day activity rollup.
 *
 * @remarks
 * Shared between the API route handler (`/api/tracked-users/[userId]`)
 * and the user detail page Server Component (hydration prefetch).
 * Centralizing the payload shape is what lets TanStack Query hydrate
 * from the RSC prefetch without an immediate client refetch — any
 * divergence in fields or formatting would invalidate the cache entry.
 *
 * `displayName` is resolved here so clients never re-implement the
 * fallback chain. The raw source fields (`customName`,
 * `displayNameTraitKey`, `projectDisplayNameTraitKey`) are echoed back
 * so the edit modal can pre-fill its inputs without a second request.
 *
 * The return value is parsed through `trackedUserDetailSchema` so
 * whichever caller consumes it (API route → JSON, RSC
 * `HydrationBoundary` prefetch) hits the same validator. Prisma-
 * select drift or a missing timestamp conversion fails fast here
 * instead of reaching the client.
 *
 * @throws {HttpError} 403 via `requireMember` if the requester is not a
 *   member of the owning organization.
 * @see src/server/auth/permissions.ts — `requireMember`
 * @see src/app/api/tracked-users/[userId]/route.ts — API route consumer
 * @see src/api-client/tracked-users/response-schemas.ts — DTO schema.
 */
export async function loadTrackedUserDetail(
  userId: TrackedUserId,
  requesterId: UserId,
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
      _count: { select: { sessions: true } },
      sessions: {
        select: { endedAt: true, duration: true, startedAt: true },
      },
    },
  });

  if (!trackedUser) return null;

  await requireMember(requesterId, trackedUser.project.organizationId, "VIEWER");

  const traits = (trackedUser.traits as Record<string, unknown>) ?? null;
  const projectDisplayNameTraitKey = trackedUser.project.defaultDisplayNameTraitKey ?? null;

  const displayName = resolveDisplayName({
    externalId: trackedUser.externalId,
    traits,
    customName: trackedUser.customName,
    displayNameTraitKey: trackedUser.displayNameTraitKey,
    projectDefaultTraitKey: projectDisplayNameTraitKey,
  });

  // Derive lastEventAt + activeTime7d from sessions (same logic as list route)
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
    // Display-name resolution inputs, echoed for the modal form state
    customName: trackedUser.customName,
    displayNameTraitKey: trackedUser.displayNameTraitKey,
    projectDisplayNameTraitKey,
  });
}
