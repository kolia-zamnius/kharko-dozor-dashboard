import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { HydrationBoundary, dehydrate } from "@tanstack/react-query";
import { getTranslations } from "next-intl/server";

import { auth } from "@/server/auth";
import { trackedUserQueries } from "@/api-client/tracked-users/queries";
import { getQueryClient } from "@/lib/query-client";
import { isHttpError } from "@/server/http-error";
import { loadTrackedUserDetail } from "@/server/tracked-users";
import type { TrackedUserId } from "@/types/ids";
import { UserDetailShell } from "./components/user-detail-shell";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("users.detail.page");
  return { title: t("title") };
}

/**
 * Server Component entrypoint for the user detail page.
 *
 * Strategy:
 * 1. Resolve the current auth session (middleware already guarantees it exists
 *    for `(dashboard)` routes, but we still need `user.id` for permission
 *    checks in the loader).
 * 2. Load the tracked user directly from Prisma via `loadTrackedUserDetail` —
 *    the same helper the API route handler uses, so the data shape is
 *    identical and hydration works without a client-side refetch.
 * 3. On 404, bail to the not-found boundary.
 * 4. Hydrate the TanStack Query cache under the same key the client would use
 *    (`trackedUserQueries.detail(userId)`) so `useTrackedUserQuery` in the
 *    shell resolves instantly from cache instead of firing a network request.
 *
 * The activity and status queries deliberately stay client-driven — they
 * change on interaction (range selector, polling) and their initial fetches
 * are cheap, so there's no meaningful gain from prefetching them here.
 */
export default async function UserDetailPage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  const session = await auth();

  if (!session?.user?.id) {
    // Defensive — middleware should have redirected already.
    notFound();
  }

  // Trust-boundary cast: `userId` enters from a URL param (raw string) —
  // branding it here so the loader's type contract catches any future
  // swap with `requesterId` inside the function body.
  // Cross-org guard inside the loader maps the foreign-org case to a
  // thrown HttpError(404) that we translate into the not-found boundary
  // below, so a guessed URL with a different-org tracked-user ID looks
  // exactly like a non-existent one.
  let trackedUser;
  try {
    trackedUser = await loadTrackedUserDetail(
      userId as TrackedUserId,
      session.user.id,
      session.user.activeOrganizationId,
    );
  } catch (err) {
    // Foreign-org / no-active-org / membership failures all map to a
    // 404 page so the URL gives no information about whether the
    // resource exists. Anything else is a genuine server error.
    if (isHttpError(err)) notFound();
    throw err;
  }
  if (!trackedUser) notFound();

  const queryClient = getQueryClient();
  queryClient.setQueryData(trackedUserQueries.detail(userId).queryKey, trackedUser);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <UserDetailShell userId={userId} />
    </HydrationBoundary>
  );
}
