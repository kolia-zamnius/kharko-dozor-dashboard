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
