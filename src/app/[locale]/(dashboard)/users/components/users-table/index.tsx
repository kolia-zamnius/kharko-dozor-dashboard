import { useTranslations } from "next-intl";

import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/data-display/table";
import type { TrackedUserListItem } from "@/api-client/tracked-users/schemas";
import type { UserListSortBy, UserListSortDir } from "@/api-client/tracked-users/domain";
import { SortableHead } from "./sortable-head";
import { UserRow } from "./user-row";

type UsersTableProps = {
  users: TrackedUserListItem[];
  sort: UserListSortBy;
  sortDir: UserListSortDir;
  onSortChange: (sort: UserListSortBy, dir: UserListSortDir) => void;
};

export function UsersTable({ users, sort, sortDir, onSortChange }: UsersTableProps) {
  const t = useTranslations("users.list.table");
  const handleSort = (column: UserListSortBy) => {
    if (sort === column) {
      onSortChange(column, sortDir === "desc" ? "asc" : "desc");
    } else {
      onSortChange(column, "desc");
    }
  };

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <SortableHead
            label={t("colUser")}
            sortKey="newest"
            activeSort={sort}
            sortDir={sortDir}
            onSort={handleSort}
            className="min-w-60"
          />
          <TableHead>{t("colProject")}</TableHead>
          <TableHead>{t("colStatus")}</TableHead>
          <SortableHead
            label={t("colLastSeen")}
            sortKey="last-seen"
            activeSort={sort}
            sortDir={sortDir}
            onSort={handleSort}
          />
          <SortableHead
            label={t("colSessions")}
            sortKey="sessions"
            activeSort={sort}
            sortDir={sortDir}
            onSort={handleSort}
          />
          <SortableHead
            label={t("colActive7d")}
            sortKey="active-time"
            activeSort={sort}
            sortDir={sortDir}
            onSort={handleSort}
          />
        </TableRow>
      </TableHeader>
      <TableBody>
        {users.map((user) => (
          <UserRow key={user.id} user={user} />
        ))}
      </TableBody>
    </Table>
  );
}
