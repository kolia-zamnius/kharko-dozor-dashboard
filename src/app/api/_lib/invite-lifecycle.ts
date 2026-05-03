import "server-only";

import { prisma } from "@/server/db/client";
import { HttpError } from "@/server/http-error";
import { log } from "@/server/logger";

/**
 * Lazy expiration on read — list endpoints fire this so stale PENDING rows
 * disappear between nightly cron runs. Failures are swallowed; a missed flip
 * just gets re-flipped on the next call.
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

type InviteForUserGuard = {
  readonly id: string;
  readonly status: string;
  readonly expiresAt: Date;
  readonly email: string;
};

/**
 * Used by `/api/user/invites/[id]/{accept,decline}`. 404 merges "missing" with
 * "already consumed" so an attacker can't enumerate invite IDs by probing 404 vs 410.
 * Side-effect — a past-TTL PENDING row is flipped to EXPIRED before throwing
 * so subsequent hits short-circuit cleanly.
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

type PendingOrgInvite = {
  readonly id: string;
  readonly organizationId: string;
  readonly status: string;
  readonly email: string;
};

/**
 * Admin-side mutations. "Not found" + "wrong org" merge into 404 so a
 * cross-org peek can't enumerate invite IDs in orgs the caller doesn't admin.
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
