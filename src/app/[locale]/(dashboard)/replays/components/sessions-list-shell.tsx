"use client";

import { useTranslations } from "next-intl";
// next-intl has no locale-aware `useSearchParams` — read raw from `next/navigation`.
// `useRouter` IS locale-aware so empty-query clears land on `/{locale}/replays`.
import { useSearchParams } from "next/navigation";
import { useRouter } from "@/i18n/navigation";
import { Suspense, useCallback, useMemo, useState } from "react";

import { LastUpdated } from "@/components/last-updated";
import { Spinner } from "@/components/ui/feedback/spinner";
import {
  DEFAULT_SESSION_DATE_RANGE,
  parseSessionDateRange,
  parseSessionListSortBy,
  parseSessionListSortDir,
  type SessionDateRange,
  type SessionListSortBy,
  type SessionListSortDir,
} from "@/api-client/sessions/domain";
import { SESSIONS_LIST_POLL_MS } from "@/api-client/sessions/constants";
import { useSessionsSummarySuspenseQuery, useSessionsSuspenseQuery } from "@/api-client/sessions/queries";
import type { SessionListItem } from "@/api-client/sessions/schemas";
import { useCanManageActiveOrg } from "@/lib/hooks/use-can-manage-active-org";
import { EmptyState } from "./empty-state";
import { FilterBar } from "./filter-bar";
import { LoadMore } from "./load-more";
import { StatsStrip } from "./stats-strip";
import { SessionsTable } from "./sessions-table";

/**
 * URL-driven list shell — paired with `UsersListShell`. URL is the source of
 * truth (every filter combo is shareable); `cursor`+`prevPages` accumulate
 * pages with id-based Set dedup.
 *
 * `canManage` is threaded to `SessionsTable` so the delete control only
 * renders for OWNER/ADMIN. The route is ADMIN-guarded regardless (double
 * validation).
 */
export function SessionsListShell() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-24">
          <Spinner />
        </div>
      }
    >
      <SessionsListShellContent />
    </Suspense>
  );
}

function SessionsListShellContent() {
  const t = useTranslations("replays.list");
  const router = useRouter();
  const searchParams = useSearchParams();

  const canManage = useCanManageActiveOrg();

  const urlSearch = searchParams?.get("search") ?? "";
  const urlProjectIds = useMemo(() => searchParams?.get("projects")?.split(",").filter(Boolean) ?? [], [searchParams]);
  const urlDateRange = parseSessionDateRange(searchParams?.get("range"));
  const urlSort = parseSessionListSortBy(searchParams?.get("sort"));
  const urlSortDir = parseSessionListSortDir(searchParams?.get("sortDir"));

  const updateUrl = useCallback(
    (updates: Record<string, string | undefined>) => {
      const params = new URLSearchParams(searchParams?.toString() ?? "");
      for (const [key, value] of Object.entries(updates)) {
        if (value) {
          params.set(key, value);
        } else {
          params.delete(key);
        }
      }
      params.delete("cursor");
      const qs = params.toString();
      router.replace(qs ? `?${qs}` : "/replays", { scroll: false });
    },
    [router, searchParams],
  );

  const handleSearchChange = useCallback((value: string) => updateUrl({ search: value || undefined }), [updateUrl]);
  const handleProjectIdsChange = useCallback(
    (ids: string[]) => updateUrl({ projects: ids.length ? ids.join(",") : undefined }),
    [updateUrl],
  );
  const handleDateRangeChange = useCallback(
    // Default-preset omitted from URL (no `?range=90d` noise); symmetric with sort/dir.
    (range: SessionDateRange) => updateUrl({ range: range === DEFAULT_SESSION_DATE_RANGE ? undefined : range }),
    [updateUrl],
  );
  const handleSortChange = useCallback(
    (sort: SessionListSortBy, dir: SessionListSortDir) =>
      updateUrl({
        sort: sort === "date" ? undefined : sort,
        sortDir: dir === "desc" ? undefined : dir,
      }),
    [updateUrl],
  );

  const [cursor, setCursor] = useState<string | undefined>();
  const [prevPages, setPrevPages] = useState<SessionListItem[]>([]);

  const filterKey = `${urlSearch}|${urlProjectIds.join(",")}|${urlDateRange}|${urlSort}|${urlSortDir}`;
  const [prevFilterKey, setPrevFilterKey] = useState(filterKey);
  if (prevFilterKey !== filterKey) {
    setPrevFilterKey(filterKey);
    setCursor(undefined);
    setPrevPages([]);
  }

  // Suspense handles initial load; cursor/filter changes use `placeholderData: keepPreviousData` (table keeps old page until new lands).
  const listParams = useMemo(
    () => ({
      search: urlSearch || undefined,
      projectIds: urlProjectIds.length ? urlProjectIds : undefined,
      range: urlDateRange !== DEFAULT_SESSION_DATE_RANGE ? urlDateRange : undefined,
      sort: urlSort !== "date" ? urlSort : undefined,
      sortDir: urlSortDir !== "desc" ? urlSortDir : undefined,
      cursor,
    }),
    [urlSearch, urlProjectIds, urlDateRange, urlSort, urlSortDir, cursor],
  );

  const list = useSessionsSuspenseQuery(listParams);
  const summary = useSessionsSummarySuspenseQuery();

  // `list.data` always defined under Suspense — no `!list.data` guard needed.
  const sessions = useMemo(() => {
    if (!cursor) return list.data.data;
    const seen = new Set(prevPages.map((s) => s.id));
    const fresh = list.data.data.filter((s) => !seen.has(s.id));
    return [...prevPages, ...fresh];
  }, [list.data, cursor, prevPages]);

  const handleLoadMore = useCallback(() => {
    if (list.data.nextCursor) {
      setPrevPages(sessions);
      setCursor(list.data.nextCursor);
    }
  }, [list.data, sessions]);

  const hasFilters = !!(urlSearch || urlProjectIds.length || urlDateRange !== DEFAULT_SESSION_DATE_RANGE);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("heading")}</h1>
          <p className="text-muted-foreground text-sm">{t("subtitle")}</p>
        </div>
        <LastUpdated
          queryKeyPrefix="sessions"
          dataUpdatedAt={list.dataUpdatedAt}
          pollIntervalMs={SESSIONS_LIST_POLL_MS}
        />
      </div>

      <StatsStrip data={summary.data} />

      <FilterBar
        search={urlSearch}
        onSearchChange={handleSearchChange}
        projectIds={urlProjectIds}
        onProjectIdsChange={handleProjectIdsChange}
        dateRange={urlDateRange}
        onDateRangeChange={handleDateRangeChange}
      />

      {/* SR-only live region — announces result-count changes to assistive tech (paired with `users-list-shell`). */}
      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {hasFilters
          ? t("liveAnnounceFiltered", { count: sessions.length })
          : t("liveAnnounce", { count: sessions.length })}
      </p>

      {sessions.length === 0 ? (
        <EmptyState hasFilters={hasFilters} />
      ) : (
        <>
          <SessionsTable
            sessions={sessions}
            sort={urlSort}
            sortDir={urlSortDir}
            onSortChange={handleSortChange}
            canManage={canManage}
          />
          {list.data.nextCursor && <LoadMore onClick={handleLoadMore} isLoading={list.isFetching && !!cursor} />}
        </>
      )}
    </div>
  );
}
