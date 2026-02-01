import "server-only";

import { INVITE_DAILY_LIMIT } from "@/api-client/organizations/constants";
import { prisma } from "@/server/db/client";
import { HttpError } from "@/server/http-error";
import type { UserId } from "@/types/ids";

/**
 * Invite send rate-limit — caps a signed-in user to
 * {@link INVITE_DAILY_LIMIT} invite dispatches per UTC day.
 *
 * @remarks
 * Structural twin of the OTP rate-limit (`src/server/auth/otp/rate-
 * limit.ts`): same `@db.Date` bucket trick for automatic midnight
 * rollover, same read-probe / atomic-bump split so enforcement and
 * accounting can't drift. The key is {@link UserId} rather than an
 * email string because invites are gated on the admin session, not
 * the recipient — rate-limiting by recipient would let an attacker
 * DoS a legitimate user's ability to get invited anywhere.
 *
 * Three entry points, in the order the invite route uses them:
 *   1. {@link assertInviteRateLimit} — throws 429 if today's bucket
 *      is full. Call BEFORE doing the invite work.
 *   2. The route does the actual invite + email send.
 *   3. {@link bumpInviteRateLimit} — atomic upsert increments
 *      today's bucket. Call AFTER the work succeeded so a DB /
 *      SMTP failure doesn't burn the admin's quota on a no-op.
 *
 * @see src/api-client/organizations/constants.ts — `INVITE_DAILY_LIMIT`
 * @see prisma/schema.prisma — `InviteSendRateLimit` model
 */

export type InviteRateLimitStatus = {
  allowed: boolean;
  /** How many sends are still available in today's bucket. */
  remaining: number;
};

function startOfUtcDay(): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

/**
 * Read today's invite-send count for `userId` without touching it.
 *
 * @remarks
 * Used by {@link assertInviteRateLimit}; also safe to call from any
 * future UI that wants to surface a "N invites remaining today" hint.
 */
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

/**
 * Atomically increment today's invite-send count for `userId`.
 *
 * @remarks
 * Upsert so the first send of the day creates the row (starting at 1,
 * per schema default), every subsequent send `{ increment: 1 }`s the
 * existing counter. Single round-trip, no read-modify-write race.
 */
export async function bumpInviteRateLimit(userId: UserId): Promise<void> {
  const today = startOfUtcDay();

  await prisma.inviteSendRateLimit.upsert({
    where: { userId_date: { userId, date: today } },
    create: { userId, date: today },
    update: { count: { increment: 1 } },
  });
}

/**
 * Throw {@link HttpError} 429 if the user has hit today's invite cap.
 *
 * @remarks
 * Gate stage for the invite route — call before doing any of the
 * actual invite work so a rate-limited admin sees the right error
 * instantly without the DB write / email dispatch running for
 * nothing.
 *
 * @throws {HttpError} 429 — daily cap reached.
 */
export async function assertInviteRateLimit(userId: UserId): Promise<void> {
  const status = await queryInviteRateLimit(userId);
  if (!status.allowed) {
    throw new HttpError(429, `Invite daily limit reached (${INVITE_DAILY_LIMIT}/day). Try again tomorrow.`);
  }
}
