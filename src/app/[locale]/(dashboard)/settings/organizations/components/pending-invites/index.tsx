import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/layout/card";
import type { UserInvite } from "@/api-client/user-invites/types";
import { EnvelopeIcon } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";
import { InvitesTable } from "./invites-table";

/**
 * "My invitations" — pure view for the invitations block on
 * `/settings/organizations`.
 *
 * By design this component does NOT read the user-invites query
 * directly. Its parent (`OrganizationsSettings`) is the composition
 * root for the page and hoists both the organizations and invites
 * queries into a single loading/error surface. By the time this
 * component renders, `invites` is guaranteed to be a real array
 * (possibly empty) — no pending state, no error state, no `undefined`.
 */
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
