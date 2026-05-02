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

/**
 * Resolve the requester's active organization, or fail if there is none.
 *
 * @remarks
 * Sole purpose: turn `string | null | undefined` into `string` with an
 * explicit `HttpError(400)` on the absent branch. List routes that
 * scope every query by `activeOrganizationId` repeat the same null
 * check inline — centralising it keeps the error message consistent
 * and the caller body one line shorter.
 *
 * @throws {HttpError} 400 — the requester has no active organization.
 */
export function requireActiveOrg(activeOrganizationId: string | null | undefined): string {
  if (!activeOrganizationId) {
    throw new HttpError(400, "No active organization");
  }
  return activeOrganizationId;
}

/**
 * Cross-org guard for `[resourceId]` routes. Asserts:
 *   1. The requester has an active organization (400 otherwise).
 *   2. The resource lives under that active organization (opaque 404
 *      otherwise — never 403, since 403 leaks the resource's
 *      existence to a member of an unrelated org).
 *   3. The requester is a member of that org at `minRole` or above
 *      (403 otherwise — JWT membership cache may be stale, so this
 *      DB hit is the authoritative check).
 *
 * @remarks
 * Use this on every route whose resource ID arrives via the URL
 * (`/api/sessions/[id]`, `/api/tracked-users/[id]/*`). List routes
 * already scope queries by the active org from the start — they call
 * `requireActiveOrg` + `requireMember` directly without the existence
 * check.
 *
 * The 404 (instead of 403) on the cross-org branch is deliberate.
 * GitHub-style: a private resource you cannot see is indistinguishable
 * from a non-existent one. Otherwise a member of org B who guesses
 * an org-A session ID gets a confirming 403 and learns that ID exists.
 *
 * @throws {HttpError} 400 — no active organization on the requester.
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
