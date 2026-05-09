import { Button } from "@/components/ui/primitives/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/overlays/dialog";
import { Separator } from "@/components/ui/primitives/separator";
import type { Organization } from "@/api-client/organizations/schemas";
import { UserPlusIcon } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { NewInviteForm } from "./new-invite-form";
import { PendingInvitesSection } from "./pending-invites-section";

/** `{open && ...}` defers `PendingInvitesSection`'s query until the dialog opens — keeps every card on the page from firing a network request on mount. */
export function InviteModal({ org }: { org: Organization }) {
  const t = useTranslations("settings.orgs.invite");
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" aria-label={t("triggerAria")} className="gap-1.5 px-2">
          <UserPlusIcon />
          <span>{t("trigger")}</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        {open && (
          <>
            <DialogHeader>
              <DialogTitle>{t("dialogTitle", { orgName: org.name })}</DialogTitle>
            </DialogHeader>

            <div className="space-y-5">
              <NewInviteForm org={org} />
              <Separator />
              <PendingInvitesSection org={org} />
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
