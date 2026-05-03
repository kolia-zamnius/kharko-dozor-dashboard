import { withAuth } from "@/app/api/_lib/with-auth";
import { loadTrackedUserDetail } from "@/server/tracked-users";
import { HttpError } from "@/server/http-error";
import type { TrackedUserId } from "@/types/ids";
import { NextResponse } from "next/server";

type Params = { userId: string };

/**
 * Same loader as the user-detail page's prefetch — byte-identical shape so
 * `HydrationBoundary` skips the on-mount refetch. Permission check lives
 * inside the loader.
 */
export const GET = withAuth<Params>(async (_req, user, { userId }) => {
  // Trust-boundary cast — `userId` arrives as a raw URL param.
  const trackedUser = await loadTrackedUserDetail(userId as TrackedUserId, user.id, user.activeOrganizationId);

  if (!trackedUser) {
    throw new HttpError(404, "User not found");
  }

  return NextResponse.json(trackedUser);
});
