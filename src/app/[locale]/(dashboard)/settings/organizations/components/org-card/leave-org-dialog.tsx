import { Button } from "@/components/ui/primitives/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/overlays/dialog";
import { useRemoveMemberMutation } from "@/api-client/organizations/mutations";
import type { Organization } from "@/api-client/organizations/schemas";
import { SignOutIcon } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";
import { useState } from "react";

export function LeaveOrgDialog({ org }: { org: Organization }) {
  const tCard = useTranslations("settings.orgs.card");
  const t = useTranslations("settings.orgs.leave");
  const [open, setOpen] = useState(false);
  const removeMember = useRemoveMemberMutation();

  // `isSelf` + `orgName` are picked up by the mutation's dynamic
  // `meta.successKey` to render `You left ${orgName}` automatically.
  function handleLeave() {
    removeMember.mutate(
      { orgId: org.id, memberId: org.membershipId, isSelf: true, orgName: org.name },
      { onSuccess: () => setOpen(false) },
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={tCard("leaveAria")} className="text-destructive">
          <SignOutIcon />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("title", { orgName: org.name })}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>
            {t("cancel")}
          </Button>
          <Button variant="destructive" size="sm" onClick={handleLeave} disabled={removeMember.isPending}>
            {t("confirm")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
