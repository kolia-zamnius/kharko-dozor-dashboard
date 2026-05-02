import { ArrowDownIcon, ArrowUpIcon, CaretUpDownIcon } from "@phosphor-icons/react";

import { TableHead } from "@/components/ui/data-display/table";
import type { SessionListSortBy, SessionListSortDir } from "@/api-client/sessions/domain";
import { cn } from "@/lib/cn";

type SortableHeadProps = {
  label: string;
  sortKey: SessionListSortBy;
  activeSort: SessionListSortBy;
  sortDir: SessionListSortDir;
  onSort: (key: SessionListSortBy) => void;
  className?: string;
};

/**
 * Table column header with sort toggle. Active column shows an arrow
 * indicating direction; inactive sortable columns show a neutral icon.
 *
 * @remarks
 * `aria-sort` is set on the `<th>` so screen readers announce the
 * current sort direction alongside the column name. Required by WAI-ARIA
 * for any column that participates in row sorting.
 */
export function SortableHead({ label, sortKey, activeSort, sortDir, onSort, className }: SortableHeadProps) {
  const isActive = activeSort === sortKey;
  const ariaSort = isActive ? (sortDir === "desc" ? "descending" : "ascending") : "none";

  return (
    <TableHead aria-sort={ariaSort} className={cn("p-0", className)}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={cn(
          "hover:text-foreground inline-flex h-full w-full items-center gap-1 px-2 py-1.5 text-left transition-colors",
          isActive ? "text-foreground" : "text-muted-foreground",
        )}
      >
        {label}
        {isActive ? (
          sortDir === "desc" ? (
            <ArrowDownIcon size={12} weight="bold" />
          ) : (
            <ArrowUpIcon size={12} weight="bold" />
          )
        ) : (
          <CaretUpDownIcon size={12} className="text-muted-foreground/50" />
        )}
      </button>
    </TableHead>
  );
}
