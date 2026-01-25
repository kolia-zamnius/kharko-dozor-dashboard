/**
 * Server-side RBAC gatekeepers — the API-route half of the
 * double-validation model (UI hides affordances, API returns 403).
 *
 * @remarks
 * Capability matrix (what each rank can do org-wide — every check in
 * this file boils down to `hasMinRole(membership.role, minRole)`):
 *
 *   - `OWNER`  (rank 2) — governance: invite lifecycle, member role
 *     changes, remove-other-member, delete org, entire API-key
 *     lifecycle (create project, regenerate, copy plaintext, delete).
 *   - `ADMIN`  (rank 1) — day-to-day edits: org name/avatar, project
 *     rename, `defaultDisplayNameTraitKey`, tracked-user `displayName`,
 *     session delete. No key material access.
 *   - `VIEWER` (rank 0) — read-only. Can self-leave org, accept/decline
 *     invites for their own email, edit their own profile.
 *
 * Rank is stored as a lookup instead of a string-compare so "at least
 * OWNER" translates to a single `>=` rather than an N-way `switch`.
 *
 * @see src/app/api/_lib/with-auth.ts — catches `HttpError` and emits
 *   the 403 / 404 to the client.
 */

import "server-only";

import { HttpError } from "@/server/http-error";
import { prisma } from "@/server/db/client";
import type { Membership, Project, Role } from "@/generated/prisma/client";
import type { UserId } from "@/types/ids";

/**
 * Role → numeric rank for "at least this role" comparisons.
 *
 * `as const satisfies` (rather than a plain type annotation) makes
 * adding a new value to the Prisma `Role` enum a **compile error**
 * here until this mapping is updated. With `: Record<Role, number>`
 * a missing key would silently read as `undefined` at runtime and
 * every rank comparison would return `false` — a classic silent-
 * downgrade bug.
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
 * Assert the requester is a member of `organizationId` with at least
 * `minRole`, and return their membership row.
 *
 * @remarks
 * Returning the row (not just asserting) saves every caller a second
 * `findUnique` when they also need the role / joinedAt / cached fields.
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
 * Assert the requester has access to a project through the owning
 * organization, with at least `minRole`.
 *
 * @remarks
 * Returns both the project (with just `id` + `organizationId`) and the
 * membership row so common patterns — "look up project, check
 * permission, then read/write the project" — collapse into a single
 * database round-trip from the caller's perspective.
 *
 * @throws {HttpError} 404 — project does not exist.
 * @throws {HttpError} 403 — project exists but requester lacks membership
 *   at `minRole` or above on the owning organization.
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
