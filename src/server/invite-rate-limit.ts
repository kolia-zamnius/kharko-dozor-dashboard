import "server-only";

import { INVITE_DAILY_LIMIT } from "@/api-client/organizations/constants";
import { prisma } from "@/server/db/client";
import { HttpError } from "@/server/http-error";
import type { UserId } from "@/types/ids";

/**
 * Caps invite sends per signed-in user per UTC day. Keyed by `UserId` (not
 * recipient email) — recipient-keyed would let an attacker DoS a user's ability
 * to be invited anywhere. Three-step pattern: `assertInviteRateLimit` (429 if cap),
 * do the work, `bumpInviteRateLimit` (only on success — failed sends don't burn quota).
 */

export type InviteRateLimitStatus = {
  allowed: boolean;
  /** Sends still available in today's bucket. */
  remaining: number;
};

function startOfUtcDay(): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

export async function queryInviteRateLimit(userId: UserId): Promise<InviteRateLimitStatus> {
  const today = startOfUtcDay();

  const row = await prisma.inviteSendRateLimit.findUnique({
    where: { userId_date: { userId, date: today } },
    select: { count: true },
  });

  const count = row?.count ?? 0;
  return {
    allowed: count < INVITE_DAILY_LIMIT,
    remaining: Math.max(0, INVITE_DAILY_LIMIT - count),
  };
}

export async function bumpInviteRateLimit(userId: UserId): Promise<void> {
  const today = startOfUtcDay();

  await prisma.inviteSendRateLimit.upsert({
    where: { userId_date: { userId, date: today } },
    create: { userId, date: today },
    update: { count: { increment: 1 } },
  });
}

/**
 * @throws {HttpError} 429 — daily cap reached.
 */
export async function assertInviteRateLimit(userId: UserId): Promise<void> {
  const status = await queryInviteRateLimit(userId);
  if (!status.allowed) {
    throw new HttpError(429, `Invite daily limit reached (${INVITE_DAILY_LIMIT}/day). Try again tomorrow.`);
  }
}
