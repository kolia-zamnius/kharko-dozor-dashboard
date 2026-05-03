import type { Metadata } from "next";
import { HydrationBoundary, dehydrate } from "@tanstack/react-query";
import { getTranslations } from "next-intl/server";

import { organizationQueries } from "@/api-client/organizations/queries";
import { userInviteQueries } from "@/api-client/user-invites/queries";
import { getQueryClient } from "@/lib/query-client";
import { auth } from "@/server/auth";
import { OrganizationsSettings } from "./components/organizations-settings";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("settings.page");
  return { title: t("orgsTitle") };
}

export default async function OrganizationsSettingsPage() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const queryClient = getQueryClient();
  await Promise.all([
    queryClient.prefetchQuery(organizationQueries.all()),
    queryClient.prefetchQuery(userInviteQueries.all()),
  ]);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <OrganizationsSettings />
    </HydrationBoundary>
  );
}
