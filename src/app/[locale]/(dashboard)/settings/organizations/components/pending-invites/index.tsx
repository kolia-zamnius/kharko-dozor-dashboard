import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/layout/card";
import type { UserInvite } from "@/api-client/user-invites/types";
import { EnvelopeIcon } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";
import { InvitesTable } from "./invites-table";

/** Pure view — parent shell hoists both queries into one Suspense boundary, so `invites` is guaranteed defined here. */
export function PendingInvitesSection({ invites }: { invites: UserInvite[] }) {
  const t = useTranslations("settings.orgs.invitations");
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <EnvelopeIcon className="size-4" />
          {t("title")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {invites.length === 0 ? (
          <p className="text-muted-foreground text-sm">{t("empty")}</p>
        ) : (
          <InvitesTable invites={invites} />
        )}
      </CardContent>
    </Card>
  );
}
