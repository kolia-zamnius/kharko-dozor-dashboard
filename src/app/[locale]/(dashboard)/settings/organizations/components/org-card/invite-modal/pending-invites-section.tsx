import { Alert, AlertDescription, AlertTitle } from "@/components/ui/feedback/alert";
import { Spinner } from "@/components/ui/feedback/spinner";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/data-display/table";
import { useInvitesQuery } from "@/api-client/organizations/queries";
import type { Organization } from "@/api-client/organizations/types";
import { WarningCircleIcon } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";
import { InviteRow } from "./invite-row";

/** Owns its own query — `NewInviteForm` above doesn't depend on it, so blocking the whole modal on the list fetch would harm the primary "add someone" flow. */
export function PendingInvitesSection({ org }: { org: Organization }) {
  const t = useTranslations("settings.orgs.invite.pending");
  const invites = useInvitesQuery(org.id);

  let body;
  if (invites.status === "pending") {
    body = (
      <div className="flex justify-center py-6">
        <Spinner />
      </div>
    );
  } else if (invites.status === "error") {
    // The underlying error is already logged centrally by the
    // `QueryCache` handler in `lib/query-client.ts`; this alert just
    // surfaces the failure to the admin.
    body = (
      <Alert variant="destructive">
        <WarningCircleIcon />
        <AlertTitle>{t("errorTitle")}</AlertTitle>
        <AlertDescription>{t("errorDescription")}</AlertDescription>
      </Alert>
    );
  } else if (invites.data.length === 0) {
    body = <p className="text-muted-foreground py-4 text-center text-xs">{t("empty")}</p>;
  } else {
    body = (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("col.email")}</TableHead>
            <TableHead>{t("col.role")}</TableHead>
            <TableHead>{t("col.expires")}</TableHead>
            <TableHead>{t("col.invitedBy")}</TableHead>
            <TableHead className="text-right">{t("col.actions")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {invites.data.map((invite) => (
            <InviteRow key={invite.id} orgId={org.id} invite={invite} />
          ))}
        </TableBody>
      </Table>
    );
  }

  return (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold">{t("heading")}</h3>
      {body}
    </section>
  );
}
