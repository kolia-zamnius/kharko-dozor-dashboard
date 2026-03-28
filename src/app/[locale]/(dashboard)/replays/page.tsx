import type { Metadata } from "next";
import { HydrationBoundary, dehydrate } from "@tanstack/react-query";
import { getTranslations } from "next-intl/server";

import { auth } from "@/server/auth";
import { sessionQueries } from "@/api-client/sessions/queries";
import { getQueryClient } from "@/lib/query-client";
import { SessionsListShell } from "./components/sessions-list-shell";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("replays.page");
  return { title: t("listTitle") };
}

/**
 * Server Component entrypoint for the replays list page.
 *
 * Prefetches the default list (no filters, first page) and summary
 * into the query client so the shell's hooks resolve instantly from
 * cache on first render — zero waterfall. Filter-driven queries are
 * NOT prefetched — they're triggered by client interaction.
 */
export default async function ReplaysPage() {
  const session = await auth();

  // Defensive — proxy.ts should have redirected unauthenticated users.
  if (!session?.user?.id) return null;

  const queryClient = getQueryClient();

  // Prefetch default list + summary in parallel.
  await Promise.all([
    queryClient.prefetchQuery(sessionQueries.list()),
    queryClient.prefetchQuery(sessionQueries.summary()),
  ]);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <div className="py-6">
        <SessionsListShell />
      </div>
    </HydrationBoundary>
  );
}
