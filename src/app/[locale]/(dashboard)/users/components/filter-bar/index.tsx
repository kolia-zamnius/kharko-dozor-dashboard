import type { UserActivityStatus } from "@/api-client/tracked-users/domain";
import { ProjectFilter } from "./project-filter";
import { SearchInput } from "./search-input";
import { StatusFilter } from "./status-filter";

type FilterBarProps = {
  search: string;
  onSearchChange: (value: string) => void;
  projectIds: string[];
  onProjectIdsChange: (ids: string[]) => void;
  statuses: UserActivityStatus[];
  onStatusesChange: (statuses: UserActivityStatus[]) => void;
};

export function FilterBar({
  search,
  onSearchChange,
  projectIds,
  onProjectIdsChange,
  statuses,
  onStatusesChange,
}: FilterBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="min-w-50 flex-1">
        <SearchInput value={search} onChange={onSearchChange} />
      </div>
      <ProjectFilter selected={projectIds} onChange={onProjectIdsChange} />
      <StatusFilter selected={statuses} onChange={onStatusesChange} />
    </div>
  );
}
