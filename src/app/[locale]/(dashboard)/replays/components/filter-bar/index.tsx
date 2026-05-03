import type { SessionDateRange } from "@/api-client/sessions/domain";
import { DateRangeFilter } from "./date-range-filter";
import { ProjectFilter } from "./project-filter";
import { SearchInput } from "./search-input";

type FilterBarProps = {
  search: string;
  onSearchChange: (value: string) => void;
  projectIds: string[];
  onProjectIdsChange: (ids: string[]) => void;
  dateRange: SessionDateRange;
  onDateRangeChange: (range: SessionDateRange) => void;
};

export function FilterBar({
  search,
  onSearchChange,
  projectIds,
  onProjectIdsChange,
  dateRange,
  onDateRangeChange,
}: FilterBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="min-w-50 flex-1">
        <SearchInput value={search} onChange={onSearchChange} />
      </div>
      <ProjectFilter selected={projectIds} onChange={onProjectIdsChange} />
      <DateRangeFilter selected={dateRange} onChange={onDateRangeChange} />
    </div>
  );
}
