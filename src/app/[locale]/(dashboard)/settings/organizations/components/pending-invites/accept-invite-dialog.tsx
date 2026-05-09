import { Button } from "@/components/ui/primitives/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/overlays/dialog";
import { useAcceptInviteMutation } from "@/api-client/user-invites/mutations";
import type { UserInvite } from "@/api-client/user-invites/schemas";
import { useFormatters } from "@/lib/use-formatters";
import { CheckIcon } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";
import { useState } from "react";

export function AcceptInviteDialog({ invite }: { invite: UserInvite }) {
  const t = useTranslations("settings.orgs.invitations.accept");
  const { formatRole } = useFormatters();
  const [open, setOpen] = useState(false);
  const acceptInvite = useAcceptInviteMutation();

  function handleAccept() {
    acceptInvite.mutate(
      { inviteId: invite.id, organizationName: invite.organization.name },
      { onSuccess: () => setOpen(false) },
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" aria-label={t("triggerAria", { orgName: invite.organization.name })}>
          <CheckIcon />
          {t("trigger")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("dialogTitle", { orgName: invite.organization.name })}</DialogTitle>
          <DialogDescription>
            {t.rich("dialogDescription", {
              role: () => <strong>{formatRole(invite.role)}</strong>,
            })}
          </DialogDescription>
        </DialogHeader>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>
            {t("cancel")}
          </Button>
          <Button size="sm" onClick={handleAccept} disabled={acceptInvite.isPending}>
            {t("confirm")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
