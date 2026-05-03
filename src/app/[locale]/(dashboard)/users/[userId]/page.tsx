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
 * Hydrates `trackedUserQueries.detail` from `loadTrackedUserDetail` (same
 * helper the API route uses → byte-identical shape, no client refetch).
 * Activity/status stay client-driven — they change on interaction and
 * prefetching wouldn't help.
 */
export default async function UserDetailPage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  const session = await auth();

  if (!session?.user?.id) {
    // Defensive — middleware should have redirected already.
    notFound();
  }

  // Trust-boundary cast — `userId` is a raw URL param. The loader's
  // foreign-org guard throws `HttpError(404)`; we translate to `notFound()`
  // so URLs give no signal about resource existence.
  let trackedUser;
  try {
    trackedUser = await loadTrackedUserDetail(
      userId as TrackedUserId,
      session.user.id,
      session.user.activeOrganizationId,
    );
  } catch (err) {
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
