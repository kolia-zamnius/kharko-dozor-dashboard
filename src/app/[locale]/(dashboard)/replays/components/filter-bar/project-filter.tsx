import { CheckIcon, FunnelIcon } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/primitives/button";
import { Badge } from "@/components/ui/primitives/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/overlays/popover";
import { useProjectsQuery } from "@/api-client/projects/queries";
import { cn } from "@/lib/cn";

type ProjectFilterProps = {
  selected: string[];
  onChange: (projectIds: string[]) => void;
};

/**
 * Multi-select project filter as a popover with checkmark list.
 * Identical pattern to the users page — shared cache via `useProjectsQuery`.
 */
export function ProjectFilter({ selected, onChange }: ProjectFilterProps) {
  const t = useTranslations("replays.list.projectFilter");
  const { data: projects } = useProjectsQuery();

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
          {selectedCount > 0 && (
            <Badge variant="secondary" className="ml-0.5 size-5 rounded-full p-0 text-[10px]">
              {selectedCount}
            </Badge>
          )}
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
