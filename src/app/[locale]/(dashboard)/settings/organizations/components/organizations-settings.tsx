"use client";

import { Suspense } from "react";

import { Spinner } from "@/components/ui/feedback/spinner";
import { useOrganizationsSuspenseQuery } from "@/api-client/organizations/queries";
import { useUserInvitesSuspenseQuery } from "@/api-client/user-invites/queries";
import { useTranslations } from "next-intl";
import { CreateOrgCard } from "./create-org-card";
import { OrganizationCard } from "./org-card";
import { PendingInvitesSection } from "./pending-invites";

export function OrganizationsSettings() {
  const t = useTranslations("settings.orgs");
  return (
    <div className="mx-auto max-w-2xl space-y-6 py-6">
      <h1 className="text-2xl font-bold tracking-tight">{t("heading")}</h1>
      <Suspense
        fallback={
          <div className="flex justify-center py-12">
            <Spinner />
          </div>
        }
      >
        <OrganizationsSettingsContent />
      </Suspense>
    </div>
  );
}

function OrganizationsSettingsContent() {
  const { data: orgs } = useOrganizationsSuspenseQuery();
  const { data: invites } = useUserInvitesSuspenseQuery();

  return (
    <>
      <PendingInvitesSection invites={invites} />
      {orgs.map((org) => (
        <OrganizationCard key={org.id} org={org} />
      ))}
      <CreateOrgCard />
    </>
  );
}
