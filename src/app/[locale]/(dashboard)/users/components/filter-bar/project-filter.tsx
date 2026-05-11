import { CheckIcon, FunnelIcon } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";
import { useSession } from "next-auth/react";

import { Button } from "@/components/ui/primitives/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/overlays/popover";
import { FilterCountBadge } from "@/app/[locale]/(dashboard)/components/filter-count-badge";
import { useOrgProjectsQuery } from "@/api-client/projects/queries";
import { cn } from "@/lib/cn";

type ProjectFilterProps = {
  selected: string[];
  onChange: (projectIds: string[]) => void;
};

export function ProjectFilter({ selected, onChange }: ProjectFilterProps) {
  const t = useTranslations("users.list.projectFilter");
  const { data: session } = useSession();
  const activeOrgId = session?.user?.activeOrganizationId;
  const { data: projects } = useOrgProjectsQuery(activeOrgId ?? "", !!activeOrgId);

  const toggle = (id: string) => {
    onChange(selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id]);
  };

  const selectedCount = selected.length;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <FunnelIcon size={14} />
          {t("label")}
          <FilterCountBadge count={selectedCount} />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-52 p-1">
        {!projects?.length ? (
          <p className="text-muted-foreground px-2 py-3 text-center text-xs">{t("empty")}</p>
        ) : (
          projects.map((project) => {
            const isSelected = selected.includes(project.id);
            return (
              <button
                key={project.id}
                type="button"
                onClick={() => toggle(project.id)}
                className={cn(
                  "hover:bg-muted flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors",
                  isSelected && "font-medium",
                )}
              >
                <span
                  className={cn(
                    "border-input flex size-4 shrink-0 items-center justify-center rounded-sm border",
                    isSelected && "border-primary bg-primary text-primary-foreground",
                  )}
                >
                  {isSelected && <CheckIcon size={12} />}
                </span>
                <span className="truncate">{project.name}</span>
              </button>
            );
          })
        )}
      </PopoverContent>
    </Popover>
  );
}
