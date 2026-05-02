import { Spinner } from "@/components/ui/feedback/spinner";
import { Button } from "@/components/ui/primitives/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/overlays/dialog";
import { useMembersQuery } from "@/api-client/organizations/queries";
import type { Organization } from "@/api-client/organizations/types";
import { UsersIcon } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";
import { useSession } from "next-auth/react";
import { useState } from "react";
import { MemberRow } from "./member-row";

/**
 * Dialog trigger for the members list on an `OrganizationCard`.
 *
 * @remarks
 * The trigger button doubles as a live member count ("5 members"),
 * which means it has to render regardless of whether the dialog is
 * open. The content itself (`MembersContent`) mounts ONLY while the
 * dialog is open — `{open && <MembersContent … />}` — so that the
 * members list query doesn't fire until the admin actually asks for
 * it. This keeps `/settings/organizations` fast even for users in
 * many orgs: N org cards no longer means N pre-warmed members
 * queries.
 */
export function MembersModal({ org }: { org: Organization }) {
  const t = useTranslations("settings.orgs.members");
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" aria-label={t("triggerAria")} className="gap-1.5 px-2">
          <UsersIcon />
          <span>{t("countLabel", { count: org.memberCount })}</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        {open && <MembersContent org={org} close={() => setOpen(false)} />}
      </DialogContent>
    </Dialog>
  );
}

/**
 * Lazy-mounted body for the members dialog. Owns the members query
 * and the current-user identity bits each {@link MemberRow} needs to
 * decide which controls to render.
 *
 * @remarks
 * `isOwner` gates the role-change Select on every row (OWNER-only per
 * the capability matrix in `permissions.ts`). `isSelf` hides destructive
 * controls on the current user's own row — leave-org flow lives
 * elsewhere. `isOnlyMember` disables leave for the last member (the
 * server would 409 anyway, but showing a disabled control is kinder
 * than firing a toast).
 *
 * Each row owns its own `useUpdateMemberRoleMutation` and observes
 * org-wide in-flight status via `useIsMutating` against the shared
 * `mutationKey` — the parent doesn't have to thread `isPending` /
 * `onRoleChange` callbacks. Toast copy still comes from the mutation's
 * dynamic `meta.successKey`; remove/leave toasts come from their own
 * mutations inside `MemberRemoveDialog`. No inline toasting here.
 */
function MembersContent({ org, close }: { org: Organization; close: () => void }) {
  const t = useTranslations("settings.orgs.members");
  const { data: session } = useSession();
  const { data: members, isLoading } = useMembersQuery(org.id);

  const isOwner = org.role === "OWNER";
  const currentUserId = session?.user?.id;

  return (
    <>
      <DialogHeader>
        <DialogTitle>{t("dialogTitle", { orgName: org.name })}</DialogTitle>
      </DialogHeader>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Spinner />
        </div>
      ) : !members?.length ? (
        <p className="text-muted-foreground py-4 text-center text-sm">{t("empty")}</p>
      ) : (
        <div className="space-y-3">
          {members.map((member) => (
            <MemberRow
              key={member.id}
              org={org}
              member={member}
              isOwner={isOwner}
              isSelf={member.user.id === currentUserId}
              isOnlyMember={members.length === 1}
              onLeaveSuccess={close}
            />
          ))}
        </div>
      )}
    </>
  );
}
