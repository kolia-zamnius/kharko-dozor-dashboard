/**
 * Server-side RBAC — API-route half of the double-validation pattern (UI hides
 * affordances, API returns 403). Capability matrix:
 * - OWNER  (rank 2): governance — invite lifecycle, member roles, delete org,
 *   full API-key lifecycle (create / regenerate / copy plaintext / delete).
 * - ADMIN  (rank 1): day-to-day edits — org name/avatar, project rename,
 *   `defaultDisplayNameTraitKey`, tracked-user `displayName`, session delete.
 *   No key material.
 * - VIEWER (rank 0): read-only. Self-leave org, accept/decline own invites,
 *   edit own profile.
 */

import "server-only";

import { HttpError } from "@/server/http-error";
import { prisma } from "@/server/db/client";
import type { Membership, Project, Role } from "@/generated/prisma/client";
import type { UserId } from "@/types/ids";

/**
 * `as const satisfies` (not `: Record<Role, number>`) — adding a Prisma `Role`
 * variant becomes a compile error here, not a silent `undefined` lookup that
 * would downgrade every comparison to `false`.
 */
const roleRank = {
  VIEWER: 0,
  ADMIN: 1,
  OWNER: 2,
} as const satisfies Record<Role, number>;

function hasMinRole(role: Role, minRole: Role): boolean {
  return roleRank[role] >= roleRank[minRole];
}

/**
 * Returns the membership row, not just asserts — saves callers a second
 * `findUnique` when they also need `joinedAt` / cached fields.
 *
 * @throws {HttpError} 403 — not a member, or role below `minRole`.
 */
export async function requireMember(
  userId: UserId,
  organizationId: string,
  minRole: Role = "VIEWER",
): Promise<Membership> {
  const membership = await prisma.membership.findUnique({
    where: { userId_organizationId: { userId, organizationId } },
  });

  if (!membership) {
    throw new HttpError(403, "Not a member");
  }

  if (!hasMinRole(membership.role, minRole)) {
    throw new HttpError(403, "Insufficient permissions");
  }

  return membership;
}

/**
 * Returns project + membership in one call so the common "look up project,
 * check permission, read it" pattern collapses to a single round-trip.
 *
 * @throws {HttpError} 404 — project not found.
 * @throws {HttpError} 403 — requester lacks `minRole` on the owning org.
 */
export async function requireProjectMember(
  userId: UserId,
  projectId: string,
  minRole: Role = "VIEWER",
): Promise<{ project: Pick<Project, "id" | "organizationId">; membership: Membership }> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, organizationId: true },
  });

  if (!project) {
    throw new HttpError(404, "Project not found");
  }

  const membership = await requireMember(userId, project.organizationId, minRole);
  return { project, membership };
}

/**
 * Centralised null check for `activeOrganizationId`. List routes scope every
 * query by it — keeping the 400 message consistent.
 *
 * @throws {HttpError} 400 — no active organization.
 */
export function requireActiveOrg(activeOrganizationId: string | null | undefined): string {
  if (!activeOrganizationId) {
    throw new HttpError(400, "No active organization");
  }
  return activeOrganizationId;
}

/**
 * Cross-org guard for `[resourceId]` routes. The 404 (not 403) on the cross-org
 * branch is deliberate — GitHub-style: a private resource you can't see is
 * indistinguishable from one that doesn't exist. Otherwise a member of org B
 * who guesses an org-A session ID would get a confirming 403 and learn the ID
 * exists. The DB membership check is the authoritative one — JWT cache may be
 * stale (user removed since their last token write).
 *
 * @throws {HttpError} 400 — no active org on the requester.
 * @throws {HttpError} 404 — resource is not in the active organization.
 * @throws {HttpError} 403 — membership / role check failed.
 */
export async function requireResourceAccess(
  userId: UserId,
  activeOrganizationId: string | null | undefined,
  resourceOrgId: string,
  minRole: Role = "VIEWER",
): Promise<Membership> {
  const activeOrgId = requireActiveOrg(activeOrganizationId);
  if (resourceOrgId !== activeOrgId) {
    throw new HttpError(404, "Not found");
  }
  return requireMember(userId, resourceOrgId, minRole);
}
