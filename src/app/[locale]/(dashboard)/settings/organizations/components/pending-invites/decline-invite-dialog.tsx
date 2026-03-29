import { Button } from "@/components/ui/primitives/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/overlays/dialog";
import { useDeclineInviteMutation } from "@/api-client/user-invites/mutations";
import type { UserInvite } from "@/api-client/user-invites/types";
import { XIcon } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";
import { useState } from "react";

/**
 * Confirm dialog for declining an invite. Decline is a hard-delete on
 * the server (no DECLINED status — see the route handler comment), so
 * the copy explicitly warns that the action is final and the admin will
 * need to re-send a new invite if the user changes their mind.
 */
export function DeclineInviteDialog({ invite }: { invite: UserInvite }) {
  const t = useTranslations("settings.orgs.invitations.decline");
  const [open, setOpen] = useState(false);
  const declineInvite = useDeclineInviteMutation();

  function handleDecline() {
    declineInvite.mutate(
      { inviteId: invite.id, organizationName: invite.organization.name },
      { onSuccess: () => setOpen(false) },
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" aria-label={t("triggerAria", { orgName: invite.organization.name })}>
          <XIcon />
          {t("trigger")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("dialogTitle", { orgName: invite.organization.name })}</DialogTitle>
          <DialogDescription>{t("dialogDescription")}</DialogDescription>
        </DialogHeader>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>
            {t("cancel")}
          </Button>
          <Button variant="destructive" size="sm" onClick={handleDecline} disabled={declineInvite.isPending}>
            {t("confirm")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
