import { Button } from "@/components/ui/primitives/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/overlays/dialog";
import { Separator } from "@/components/ui/primitives/separator";
import type { Organization } from "@/api-client/organizations/types";
import { UserPlusIcon } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { NewInviteForm } from "./new-invite-form";
import { PendingInvitesSection } from "./pending-invites-section";

/**
 * Admin-side invite modal — triggers from the org card, opens two
 * stacked concerns:
 *
 *   1. `NewInviteForm` — send a fresh invite (or idempotently re-send
 *      an existing one by re-submitting the same email).
 *   2. `PendingInvitesSection` — table of outstanding PENDING invites
 *      with inline role edit, expiration extend, and revoke actions.
 *
 * Only rendered by `OrganizationCard` when `canInvite` is true
 * (OWNER on a non-PERSONAL org), so admins and viewers never see the
 * trigger in the first place. The underlying API routes are also
 * OWNER-gated — double enforcement means a hand-crafted fetch from a
 * non-owner tab still gets a 403.
 *
 * The query inside `PendingInvitesSection` is gated by `{open && ...}`
 * below: we only mount the inner content while the dialog is open, so
 * the invites fetch is deferred until someone actually clicks Invite.
 * Keeps every card on the settings page from firing a network request
 * on mount.
 */
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
