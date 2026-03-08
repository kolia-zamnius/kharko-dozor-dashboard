import { withAuth } from "@/app/api/_lib/with-auth";
import { loadTrackedUserDetail } from "@/server/tracked-users";
import { HttpError } from "@/server/http-error";
import type { TrackedUserId } from "@/types/ids";
import { NextResponse } from "next/server";

type Params = { userId: string };

/**
 * `GET /api/tracked-users/[userId]` — full tracked-user detail payload.
 *
 * @remarks
 * Delegates to {@link loadTrackedUserDetail} — the same loader the
 * user-detail page Server Component uses for hydration prefetch, so
 * client and server responses have byte-identical shape (critical
 * for `HydrationBoundary` to skip the on-mount refetch). Permission
 * check lives inside the loader.
 *
 * @see {@link trackedUserDetailOptions} — client-side consumer.
 */
export const GET = withAuth<Params>(async (_req, user, { userId }) => {
  // Trust-boundary cast — `userId` arrives as a raw string URL param.
  const trackedUser = await loadTrackedUserDetail(userId as TrackedUserId, user.id);

  if (!trackedUser) {
    throw new HttpError(404, "User not found");
  }

  return NextResponse.json(trackedUser);
});
