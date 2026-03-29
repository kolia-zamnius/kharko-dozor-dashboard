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
import type { Organization, OrganizationMember } from "@/api-client/organizations/types";
import { SignOutIcon } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";
import { useState } from "react";

type MemberRemoveDialogProps = {
  org: Organization;
  member: OrganizationMember;
  /** True when the row's member is the currently signed-in user. Drives copy + parent-close behaviour. */
  isSelf: boolean;
  /** Called after a successful self-leave so the parent members modal can close itself. */
  onLeaveSuccess?: () => void;
};

/**
 * Dual-purpose confirmation dialog for the members-modal row actions:
 *   - **Remove other member** (owner removing someone else)
 *   - **Leave organization** (member removing themselves)
 *
 * Both operations hit the same `useRemoveMemberMutation`, but copy and
 * post-success behaviour differ. Using one component keeps the row UI
 * consistent (same icon position, same dialog look) while letting the
 * `isSelf` flag flip the language and trigger the modal close.
 *
 * The mutation lives inside this component (not the parent members modal)
 * so each row's in-flight state is naturally scoped — no need for
 * `mutation.variables === member.id` matching to disable the right row.
 */
export function MemberRemoveDialog({ org, member, isSelf, onLeaveSuccess }: MemberRemoveDialogProps) {
  const t = useTranslations("settings.orgs.members");
  const [open, setOpen] = useState(false);
  const removeMember = useRemoveMemberMutation();

  function handleConfirm() {
    removeMember.mutate(
      {
        orgId: org.id,
        memberId: member.id,
        isSelf,
        // `orgName` only carried for self-leave so the dynamic
        // `meta.successKey` can render `You left ${orgName}`.
        orgName: isSelf ? org.name : undefined,
      },
      {
        onSuccess: () => {
          setOpen(false);
          if (isSelf) onLeaveSuccess?.();
        },
      },
    );
  }

  const memberName = member.user.name ?? member.user.email;
  const title = isSelf ? t("leaveTitle", { orgName: org.name }) : t("removeTitle", { memberName });
  const description = isSelf ? t("leaveDescription") : t("removeDescription", { memberName });
  const confirmLabel = isSelf ? t("confirmLeave") : t("confirmRemove");
  const triggerLabel = isSelf ? t("leaveAria") : t("removeAria");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={triggerLabel} className="text-destructive">
          <SignOutIcon />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>
            {t("cancel")}
          </Button>
          <Button variant="destructive" size="sm" onClick={handleConfirm} disabled={removeMember.isPending}>
            {confirmLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
