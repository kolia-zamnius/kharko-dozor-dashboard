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
 * Dual-purpose — `isSelf` flips language + post-success behaviour. Mutation
 * lives per-component so in-flight state is naturally row-scoped (no
 * `variables === member.id` matching).
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
        // Self-leave only — drives the dynamic `meta.successKey`.
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
