import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { useCallback, useMemo, useState } from "react";

import { Button } from "@/components/ui/primitives/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/layout/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/data-display/table";
import { useTrackedUserSessionsQuery } from "@/api-client/tracked-users/queries";
import type { PaginatedSessions, SessionListItem } from "@/api-client/sessions/types";
import { useFormatters } from "@/lib/use-formatters";

type SessionsTableProps = {
  userId: string;
  /**
   * First page of sessions, pre-fetched by `UserDetailShell` and passed
   * down so the initial render has data immediately — no internal
   * loading state, no flash. Subsequent pages are fetched via the
   * cursor state below.
   */
  initialPage: PaginatedSessions;
};

/**
 * Paginated sessions table.
 *
 * Initial render: `initialPage` is passed in by `UserDetailShell`, which
 * has already warmed the underlying query under the same key. When this
 * component mounts it calls `useTrackedUserSessionsQuery(userId,
 * undefined)` for cursor=undefined; TanStack dedupes against the shell's
 * call and returns the cached first page synchronously — zero network
 * cost, zero loading flash.
 *
 * Load More: the cursor state is owned here (button-scoped, not
 * page-scoped, so it doesn't belong in the shell). Clicking "Load more"
 * swaps in the next cursor; the query re-fires with a new key,
 * `keepPreviousData` on the query keeps the current rows visible while
 * the next page is in flight, and on success we append into the local
 * `prevPages` accumulator. The button shows "Loading…" while the new
 * page is fetching — that's the one place a loading indicator appears
 * on this page after the initial mount, and it's button-scoped, which
 * is a different UX tier from full-page loading.
 */
export function SessionsTable({ userId, initialPage }: SessionsTableProps) {
  const t = useTranslations("users.detail.sessions");
  const { formatCount, formatDuration, formatRelative, formatDateTime } = useFormatters();
  const [cursor, setCursor] = useState<string | undefined>();
  const { data = initialPage, isFetching } = useTrackedUserSessionsQuery(userId, cursor);

  // Deduplication by id prevents duplicate keys when keepPreviousData
  // holds the previous page's data while the next page is in flight.
  const [prevPages, setPrevPages] = useState<SessionListItem[]>([]);
  const sessions = useMemo(() => {
    if (!cursor) return data.data;
    const seen = new Set(prevPages.map((s) => s.id));
    const fresh = data.data.filter((s) => !seen.has(s.id));
    return [...prevPages, ...fresh];
  }, [data, cursor, prevPages]);

  const handleLoadMore = useCallback(() => {
    if (data.nextCursor) {
      setPrevPages(sessions);
      setCursor(data.nextCursor);
    }
  }, [data, sessions]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
      </CardHeader>
      <CardContent className="pb-5">
        {sessions.length === 0 ? (
          <p className="text-muted-foreground py-8 text-center text-sm">{t("empty")}</p>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("colSession")}</TableHead>
                  <TableHead>{t("colStarted")}</TableHead>
                  <TableHead className="text-right">{t("colDuration")}</TableHead>
                  <TableHead className="text-right">{t("colEvents")}</TableHead>
                  <TableHead className="text-right">{t("colSlices")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sessions.map((session) => (
                  <TableRow key={session.id}>
                    <TableCell>
                      <Link
                        href={`/replays/${session.id}`}
                        className="text-primary font-mono text-sm underline-offset-4 hover:underline"
                      >
                        {session.externalId}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      <time
                        dateTime={session.createdAt}
                        title={formatDateTime(session.createdAt, { dateStyle: "short", timeStyle: "medium" })}
                      >
                        {formatRelative(session.createdAt)}
                      </time>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-right text-sm tabular-nums">
                      {formatDuration(session.duration)}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-right text-sm tabular-nums">
                      {formatCount(session.eventCount)}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-right text-sm tabular-nums">
                      {formatCount(session.sliceCount)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {data.nextCursor && (
              <div className="mt-4 flex justify-center">
                <Button variant="ghost" size="sm" onClick={handleLoadMore} disabled={isFetching && !!cursor}>
                  {isFetching && !!cursor ? t("loading") : t("loadMore")}
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
