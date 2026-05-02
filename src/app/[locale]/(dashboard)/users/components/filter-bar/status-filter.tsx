import { CheckIcon, FunnelIcon } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/primitives/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/overlays/popover";
import { FilterCountBadge } from "@/app/[locale]/(dashboard)/components/filter-count-badge";
import { USER_ACTIVITY_STATUSES, type UserActivityStatus } from "@/api-client/tracked-users/status";
import { STATUS_COLOR } from "@/app/[locale]/(dashboard)/users/lib/status-ui";
import { cn } from "@/lib/cn";

type StatusFilterProps = {
  selected: UserActivityStatus[];
  onChange: (statuses: UserActivityStatus[]) => void;
};

/**
 * Multi-select status filter. Popover contains a vertical list of options —
 * each with a colored indicator, label, and short description explaining
 * the activity threshold so the user knows exactly what they're filtering by.
 */
export function StatusFilter({ selected, onChange }: StatusFilterProps) {
  const t = useTranslations("users.list.statusFilter");
  const tStatus = useTranslations("users.status");
  const toggle = (status: UserActivityStatus) => {
    onChange(selected.includes(status) ? selected.filter((s) => s !== status) : [...selected, status]);
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
      <PopoverContent align="start" className="w-64 p-1">
        {USER_ACTIVITY_STATUSES.map((status) => {
          const isActive = selected.includes(status);
          const color = STATUS_COLOR[status];
          return (
            <button
              key={status}
              type="button"
              onClick={() => toggle(status)}
              className={cn(
                "hover:bg-muted flex w-full items-start gap-2.5 rounded-md px-2 py-2 text-left transition-colors",
                isActive && "bg-muted/60",
              )}
            >
              <span
                className={cn(
                  "border-input mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-sm border",
                  isActive && "border-primary bg-primary text-primary-foreground",
                )}
              >
                {isActive && <CheckIcon size={12} />}
              </span>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className={cn("inline-block size-1.5 rounded-full", color.dot)} />
                  <span className="text-sm font-medium">{tStatus(`${status}.label`)}</span>
                </div>
                <p className="text-muted-foreground text-xs">{tStatus(`${status}.description`)}</p>
              </div>
            </button>
          );
        })}
      </PopoverContent>
    </Popover>
  );
}
