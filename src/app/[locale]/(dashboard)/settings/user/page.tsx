import type { Metadata } from "next";
import { HydrationBoundary, dehydrate } from "@tanstack/react-query";
import { getTranslations } from "next-intl/server";

import { userQueries } from "@/api-client/user/queries";
import { getQueryClient } from "@/lib/query-client";
import { auth } from "@/server/auth";
import { UserSettings } from "./components/user-settings";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("settings.page");
  return { title: t("userTitle") };
}

/**
 * Server Component entrypoint for `/settings/user`.
 *
 * @remarks
 * Prefetches the user profile so the page-level Suspense boundary in
 * `UserSettings` resolves from cache on first render. Same RSC-prefetch
 * pattern as `/replays` and `/users`.
 */
export default async function UserSettingsPage() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const queryClient = getQueryClient();
  await queryClient.prefetchQuery(userQueries.profile());

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <UserSettings />
    </HydrationBoundary>
  );
}
