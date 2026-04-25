import "server-only";

import { prisma } from "@/server/db/client";
import { HttpError } from "@/server/http-error";
import { log } from "@/server/logger";

/**
 * Shared invariants + lazy-expiry helpers for the `Invite` row lifecycle.
 *
 * @remarks
 * Lives in `api/_lib/` because the checks live at the API boundary —
 * they `throw` `HttpError` with route-specific status codes. Accept /
 * decline / admin-manage routes all share the same "not pending /
 * expired / wrong user" surface, so centralising removes the previous
 * duplication across five route files.
 */

/**
 * Fire-and-forget expiration of stale PENDING invite rows.
 *
 * @remarks
 * Called from list endpoints that enforce the TTL on read
 * (`GET /api/user/invites`, `GET /api/organizations/[orgId]/invites`)
 * so expired rows disappear between nightly cron runs. Failed updates
 * are logged and swallowed — worst case the row stays PENDING and gets
 * re-flipped on the next call (self-healing).
 *
 * No-op on empty input to avoid a wasted round-trip.
 *
 * @param expiredIds - IDs of invite rows whose `expiresAt` has passed.
 */
export function expireStaleInvites(expiredIds: readonly string[]): void {
  if (expiredIds.length === 0) return;
  prisma.invite
    .updateMany({
      where: { id: { in: [...expiredIds] } },
      data: { status: "EXPIRED" },
    })
    .catch((err: unknown) => log.error("org:invite:expire_sweep:failed", { err }));
}

/** Minimal shape needed by {@link assertInviteUsableForUser}. */
type InviteForUserGuard = {
  readonly id: string;
  readonly status: string;
  readonly expiresAt: Date;
  readonly email: string;
};

/**
 * Guard invariants on `/api/user/invites/[id]/{accept,decline}`:
 * the invite must exist, still be PENDING, still be within TTL, and
 * address the signed-in user's email.
 *
 * @remarks
 * Side effect: a past-TTL row that's still PENDING is flipped to
 * EXPIRED before throwing, so subsequent hits short-circuit cleanly
 * instead of re-running the guard.
 *
 * The 404 on "missing OR already consumed" is intentional — the two
 * cases are merged so an attacker can't enumerate invite IDs by
 * probing for 404 vs 410.
 *
 * @param invite - Invite row from `findUnique` (or `null` if missing).
 * @param userEmail - Signed-in user's email from the session.
 *
 * @throws {HttpError} 404 — invite missing or already consumed.
 * @throws {HttpError} 410 — row existed but TTL expired (also flips status).
 * @throws {HttpError} 403 — row belongs to a different recipient email.
 */
export async function assertInviteUsableForUser(
  invite: InviteForUserGuard | null,
  userEmail: string | null | undefined,
): Promise<void> {
  if (!invite || invite.status !== "PENDING") {
    throw new HttpError(404, "This invitation is invalid or has already been used.");
  }

  if (invite.expiresAt < new Date()) {
    await prisma.invite.update({
      where: { id: invite.id },
      data: { status: "EXPIRED" },
    });
    throw new HttpError(410, "This invitation has expired.");
  }

  if (invite.email !== userEmail) {
    throw new HttpError(
      403,
      `This invitation was sent to ${invite.email}. You are signed in as ${userEmail ?? "another account"}.`,
    );
  }
}

/** Minimal shape returned by {@link loadPendingOrgInvite}. */
type PendingOrgInvite = {
  readonly id: string;
  readonly organizationId: string;
  readonly status: string;
  readonly email: string;
};

/**
 * Load an invite and assert it belongs to `orgId` and is still PENDING.
 *
 * @remarks
 * Used by admin-side mutations (`PATCH` / `DELETE` on
 * `/api/organizations/[orgId]/invites/[inviteId]`). "Not found" and
 * "wrong org" are merged into 404 so a cross-org peek can't enumerate
 * IDs in orgs the caller doesn't administer.
 *
 * @param orgId - Organization the URL claims the invite belongs to.
 * @param inviteId - Invite primary key from the URL.
 * @returns The loaded invite — caller can skip a second `findUnique`.
 *
 * @throws {HttpError} 404 — invite missing or belongs to a different org.
 * @throws {HttpError} 409 — invite exists but is no longer PENDING.
 */
export async function loadPendingOrgInvite(orgId: string, inviteId: string): Promise<PendingOrgInvite> {
  const invite = await prisma.invite.findUnique({
    where: { id: inviteId },
    select: { id: true, organizationId: true, status: true, email: true },
  });

  if (!invite || invite.organizationId !== orgId) {
    throw new HttpError(404, "Invite not found");
  }

  if (invite.status !== "PENDING") {
    throw new HttpError(409, "Invite is no longer pending");
  }

  return invite;
}
