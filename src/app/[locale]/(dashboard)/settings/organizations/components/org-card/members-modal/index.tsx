import { Spinner } from "@/components/ui/feedback/spinner";
import { Button } from "@/components/ui/primitives/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/overlays/dialog";
import { useMembersQuery } from "@/api-client/organizations/queries";
import type { Organization } from "@/api-client/organizations/schemas";
import { UsersIcon } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";
import { useSession } from "next-auth/react";
import { useState } from "react";
import { MemberRow } from "./member-row";

/** Trigger doubles as the member-count label, but body mounts via `{open && ...}` so N org cards don't pre-warm N member queries. */
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
/**
 * `isOnlyMember` disables leave (server 409s anyway — disabled control is
 * kinder than a toast). Each row owns its mutation; org-wide in-flight is
 * tracked via `useIsMutating` on a shared `mutationKey`.
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
