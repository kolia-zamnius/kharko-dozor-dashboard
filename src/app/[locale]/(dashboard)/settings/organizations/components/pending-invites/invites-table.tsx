import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/data-display/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/primitives/avatar";
import { Badge } from "@/components/ui/primitives/badge";
import type { UserInvite } from "@/api-client/user-invites/schemas";
import { useFormatters } from "@/lib/use-formatters";
import { useTranslations } from "next-intl";
import { AcceptInviteDialog } from "./accept-invite-dialog";
import { DeclineInviteDialog } from "./decline-invite-dialog";

export function InvitesTable({ invites }: { invites: UserInvite[] }) {
  const t = useTranslations("settings.orgs.invitations.col");
  const { formatRole } = useFormatters();
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t("organization")}</TableHead>
          <TableHead>{t("role")}</TableHead>
          <TableHead>{t("invitedBy")}</TableHead>
          <TableHead className="text-right">{t("actions")}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {invites.map((invite) => (
          <TableRow key={invite.id}>
            <TableCell>
              <div className="flex items-center gap-3">
                <Avatar className="size-8 shrink-0">
                  <AvatarImage src={invite.organization.image} alt={invite.organization.name} />
                  <AvatarFallback>{invite.organization.name.charAt(0)}</AvatarFallback>
                </Avatar>
                <span className="font-medium">{invite.organization.name}</span>
              </div>
            </TableCell>
            <TableCell>
              <Badge variant="secondary">{formatRole(invite.role)}</Badge>
            </TableCell>
            <TableCell className="text-muted-foreground">{invite.invitedBy.name ?? invite.invitedBy.email}</TableCell>
            <TableCell className="text-right">
              <div className="flex justify-end gap-2">
                <AcceptInviteDialog invite={invite} />
                <DeclineInviteDialog invite={invite} />
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
