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

/**
 * Server Component entrypoint for `/settings/organizations`.
 *
 * @remarks
 * Prefetches the orgs list + pending invites into the query client so
 * the page-level Suspense boundary in `OrganizationsSettings` resolves
 * from cache on first render — same hydration pattern as `/replays`
 * and `/users`. No live polling on this page, so the prefetch payload
 * stays valid through the initial paint.
 */
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
