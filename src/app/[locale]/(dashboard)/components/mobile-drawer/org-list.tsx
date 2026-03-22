import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/primitives/avatar";
import type { Organization } from "@/api-client/organizations/types";
import { cn } from "@/lib/cn";
import { useFormatters } from "@/lib/use-formatters";
import { CheckIcon } from "@phosphor-icons/react";

type OrgListProps = {
  orgs: Organization[];
  activeOrgId: string | null;
  onSelect: (id: string) => void;
};

/**
 * Vertical list of membership rows for the mobile drawer's
 * "Switch organization" accordion. Pure view — mutation lives in
 * the parent.
 */
export function OrgList({ orgs, activeOrgId, onSelect }: OrgListProps) {
  const { formatRole } = useFormatters();
  return (
    <div className="space-y-1">
      {orgs.map((org) => {
        const selected = org.id === activeOrgId;
        return (
          <button
            key={org.id}
            type="button"
            onClick={() => !selected && onSelect(org.id)}
            className={cn(
              "flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-left text-sm",
              selected ? "cursor-default" : "hover:bg-muted",
            )}
          >
            <Avatar size="sm">
              {org.image ? <AvatarImage src={org.image} alt={org.name} /> : null}
              <AvatarFallback />
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm">{org.name}</p>
              <p className="text-muted-foreground truncate text-xs">{formatRole(org.role)}</p>
            </div>
            {selected && <CheckIcon className="shrink-0" />}
          </button>
        );
      })}
    </div>
  );
}
