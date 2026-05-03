import type { Metadata } from "next";
import { HydrationBoundary, dehydrate } from "@tanstack/react-query";
import { getTranslations } from "next-intl/server";

import { auth } from "@/server/auth";
import { trackedUserQueries } from "@/api-client/tracked-users/queries";
import { getQueryClient } from "@/lib/query-client";
import { UsersListShell } from "./components/users-list-shell";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("users.page");
  return { title: t("title") };
}

/** Prefetches default list + summary; filter-driven queries fetch on demand. */
export default async function UsersPage() {
  const session = await auth();

  if (!session?.user?.id) return null;

  const queryClient = getQueryClient();

  await Promise.all([
    queryClient.prefetchQuery(trackedUserQueries.list()),
    queryClient.prefetchQuery(trackedUserQueries.summary()),
  ]);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <div className="py-6">
        <UsersListShell />
      </div>
    </HydrationBoundary>
  );
}
