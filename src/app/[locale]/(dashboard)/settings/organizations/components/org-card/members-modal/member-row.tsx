import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/primitives/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/forms/select";
import { organizationKeys } from "@/api-client/organizations/keys";
import { useUpdateMemberRoleMutation } from "@/api-client/organizations/mutations";
import type { Organization, OrganizationMember } from "@/api-client/organizations/schemas";
import { useIsMutating } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { ROLE_OPTIONS } from "../../role-options";
import { MemberRemoveDialog } from "./member-remove-dialog";

type Props = {
  org: Organization;
  member: OrganizationMember;
  isOwner: boolean;
  isSelf: boolean;
  isOnlyMember: boolean;
  /** Called after a successful self-leave so the parent members modal can close itself. */
  onLeaveSuccess: () => void;
};

/**
 * Per-row mutation; org-wide "any role change in flight, disable all"
 * preserved via `useIsMutating({ mutationKey })` on a shared key.
 */
export function MemberRow({ org, member, isOwner, isSelf, isOnlyMember, onLeaveSuccess }: Props) {
  const t = useTranslations("settings.orgs.members");
  const tRoles = useTranslations("settings.orgs.roles");
  const updateRole = useUpdateMemberRoleMutation(org.id);
  const isAnyRoleMutating = useIsMutating({ mutationKey: organizationKeys.memberRoleMutation(org.id) }) > 0;

  return (
    <div className="flex items-center gap-3">
      <Avatar size="sm" className="shrink-0">
        <AvatarImage src={member.user.image} alt={member.user.name ?? t("unknownFallback")} />
        <AvatarFallback>{(member.user.name ?? "?").charAt(0)}</AvatarFallback>
      </Avatar>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">
          {member.user.name ?? t("unnamed")}{" "}
          {isSelf && <span className="text-muted-foreground">{t("selfSuffix")}</span>}
        </p>
        <p className="text-muted-foreground truncate text-xs">{member.user.email}</p>
      </div>

      {isOwner && !isSelf ? (
        <Select
          value={member.role}
          onValueChange={(value) => {
            if (value !== member.role) {
              updateRole.mutate({ orgId: org.id, memberId: member.id, role: value as Organization["role"] });
            }
          }}
          disabled={isAnyRoleMutating}
        >
          <SelectTrigger aria-label={t("roleAria")} className="w-32 shrink-0">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ROLE_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {tRoles(`${opt.key}.label`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <span className="text-muted-foreground shrink-0 text-sm">
          {tRoles(`${ROLE_OPTIONS.find((o) => o.value === member.role)?.key ?? "viewer"}.label`)}
        </span>
      )}

      {(isOwner || isSelf) && !isOnlyMember && (
        <MemberRemoveDialog org={org} member={member} isSelf={isSelf} onLeaveSuccess={onLeaveSuccess} />
      )}
    </div>
  );
}
