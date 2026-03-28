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

/**
 * Server Component entrypoint for the users list page.
 *
 * Strategy — mirrors `/users/[userId]/page.tsx`:
 *   1. Prefetch the default list (no filters, first page) and summary
 *      into the query client so the shell's hooks resolve instantly
 *      from cache on first render — zero waterfall.
 *   2. Wrap in `HydrationBoundary` to transfer the server cache to the
 *      client. The shell's `useTrackedUsersQuery` and
 *      `useTrackedUsersSummaryQuery` pick up the prefetched data and
 *      skip the initial network request.
 *
 * Filter-driven queries (search, project, status, sort) are NOT prefetched
 * — they're triggered by client interaction and are cheap enough to fetch
 * on demand. Only the default view is primed.
 */
export default async function UsersPage() {
  const session = await auth();

  // Defensive — proxy.ts should have redirected unauthenticated users.
  if (!session?.user?.id) return null;

  const queryClient = getQueryClient();

  // Prefetch default list + summary in parallel.
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
