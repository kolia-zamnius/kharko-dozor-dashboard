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

/** Prefetches default-list + summary so the shell's hooks resolve from cache — zero waterfall. */
export default async function ReplaysPage() {
  const session = await auth();

  // Defensive — proxy.ts should have redirected anon callers.
  if (!session?.user?.id) return null;

  const queryClient = getQueryClient();

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
