import { useTranslations } from "next-intl";

import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/data-display/table";
import type { SessionListItem } from "@/api-client/sessions/types";
import type { SessionListSortBy, SessionListSortDir } from "@/api-client/sessions/domain";
import { SortableHead } from "./sortable-head";
import { SessionRow } from "./session-row";

type SessionsTableProps = {
  sessions: SessionListItem[];
  sort: SessionListSortBy;
  sortDir: SessionListSortDir;
  onSortChange: (sort: SessionListSortBy, dir: SessionListSortDir) => void;
  canManage: boolean;
};

export function SessionsTable({ sessions, sort, sortDir, onSortChange, canManage }: SessionsTableProps) {
  const t = useTranslations("replays.list.table");
  const handleSort = (column: SessionListSortBy) => {
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
          <TableHead>{t("colSession")}</TableHead>
          <TableHead>{t("colUser")}</TableHead>
          <TableHead>{t("colProject")}</TableHead>
          <TableHead>{t("colEvents")}</TableHead>
          <SortableHead
            label={t("colDuration")}
            sortKey="duration"
            activeSort={sort}
            sortDir={sortDir}
            onSort={handleSort}
          />
          <SortableHead label={t("colDate")} sortKey="date" activeSort={sort} sortDir={sortDir} onSort={handleSort} />
          {canManage && <TableHead className="w-10" />}
        </TableRow>
      </TableHeader>
      <TableBody>
        {sessions.map((session) => (
          <SessionRow key={session.id} session={session} canManage={canManage} />
        ))}
      </TableBody>
    </Table>
  );
}
