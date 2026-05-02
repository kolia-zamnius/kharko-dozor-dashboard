"use client";

import { useTranslations } from "next-intl";
// `useSearchParams` has no locale-aware twin in next-intl — read it
// from `next/navigation`. `useRouter` swaps to the locale-aware
// version so empty-query-string filter clears land on
// `/{locale}/users` instead of stripping the locale prefix.
import { useSearchParams } from "next/navigation";
import { useRouter } from "@/i18n/navigation";
import { Suspense, useCallback, useMemo, useState } from "react";

import { LastUpdated } from "@/components/last-updated";
import { Spinner } from "@/components/ui/feedback/spinner";
import {
  parseUserListSortBy,
  parseUserListSortDir,
  type UserListSortBy,
  type UserListSortDir,
} from "@/api-client/tracked-users/domain";
import {
  useTrackedUsersSummarySuspenseQuery,
  useTrackedUsersSuspenseQuery,
  USERS_LIST_POLL_MS,
} from "@/api-client/tracked-users/queries";
import type { UserActivityStatus } from "@/api-client/tracked-users/status";
import type { TrackedUserListItem } from "@/api-client/tracked-users/types";
import { EmptyState } from "./empty-state";
import { FilterBar } from "./filter-bar";
import { LoadMore } from "./load-more";
import { StatsStrip } from "./stats-strip";
import { UsersTable } from "./users-table";

/**
 * Composition root for the `/users` page.
 *
 * @remarks
 * Implements the **"URL-driven list shell"** pattern — the same shape
 * shared with {@link SessionsListShell}. Both shells:
 *   1. Read filter/sort state from `useSearchParams()` (URL is the
 *      source of truth, so every filter combination is shareable).
 *   2. Write updates via `router.replace(qs, { scroll: false })`,
 *      clearing `cursor` on any filter change.
 *   3. Keep `cursor` + `prevPages` in local state so "Load more"
 *      accumulates pages with `Set`-based dedup on id.
 *   4. Wrap a single page-level `<Spinner />` in `Suspense`; initial-
 *      load failures bubble to the nearest `error.tsx` via the global
 *      `throwOnError` policy, polling flakes stay in toast pipeline.
 *
 * Duplicated LOC between the two shells (~38 % at audit time) is a
 * deliberate rule-of-3 deferral: with two consumers, a shared hook
 * would be premature — the filter DTO shapes differ (users has
 * `statuses`, replays has `range`) and extracting too early freezes
 * the abstraction before we understand what the third consumer needs.
 * When a third list page lands, fold the common parts into
 * `useUrlFilterState()` + `useCursorPagination()` hooks.
 *
 * @see ../../replays/components/sessions-list-shell.tsx — sibling shell.
 */
export function UsersListShell() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-24">
          <Spinner />
        </div>
      }
    >
      <UsersListShellContent />
    </Suspense>
  );
}

function UsersListShellContent() {
  const t = useTranslations("users.list");
  const router = useRouter();
  const searchParams = useSearchParams();

  const urlSearch = searchParams?.get("search") ?? "";
  const urlProjectIds = useMemo(() => searchParams?.get("projects")?.split(",").filter(Boolean) ?? [], [searchParams]);
  const urlStatuses = useMemo(
    () => (searchParams?.get("statuses")?.split(",").filter(Boolean) ?? []) as UserActivityStatus[],
    [searchParams],
  );
  const urlSort = parseUserListSortBy(searchParams?.get("sort"));
  const urlSortDir = parseUserListSortDir(searchParams?.get("sortDir"));

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
      router.replace(qs ? `?${qs}` : "/users", { scroll: false });
    },
    [router, searchParams],
  );

  const handleSearchChange = useCallback((value: string) => updateUrl({ search: value || undefined }), [updateUrl]);
  const handleProjectIdsChange = useCallback(
    (ids: string[]) => updateUrl({ projects: ids.length ? ids.join(",") : undefined }),
    [updateUrl],
  );
  const handleStatusesChange = useCallback(
    (statuses: UserActivityStatus[]) => updateUrl({ statuses: statuses.length ? statuses.join(",") : undefined }),
    [updateUrl],
  );
  const handleSortChange = useCallback(
    (sort: UserListSortBy, dir: UserListSortDir) =>
      updateUrl({
        sort: sort === "last-seen" ? undefined : sort,
        sortDir: dir === "desc" ? undefined : dir,
      }),
    [updateUrl],
  );

  const [cursor, setCursor] = useState<string | undefined>();
  const [prevPages, setPrevPages] = useState<TrackedUserListItem[]>([]);

  const filterKey = `${urlSearch}|${urlProjectIds.join(",")}|${urlStatuses.join(",")}|${urlSort}|${urlSortDir}`;
  const [prevFilterKey, setPrevFilterKey] = useState(filterKey);
  if (prevFilterKey !== filterKey) {
    setPrevFilterKey(filterKey);
    setCursor(undefined);
    setPrevPages([]);
  }

  const listParams = useMemo(
    () => ({
      search: urlSearch || undefined,
      projectIds: urlProjectIds.length ? urlProjectIds : undefined,
      statuses: urlStatuses.length ? urlStatuses : undefined,
      sort: urlSort !== "last-seen" ? urlSort : undefined,
      sortDir: urlSortDir !== "desc" ? urlSortDir : undefined,
      cursor,
    }),
    [urlSearch, urlProjectIds, urlStatuses, urlSort, urlSortDir, cursor],
  );

  const list = useTrackedUsersSuspenseQuery(listParams);
  const summary = useTrackedUsersSummarySuspenseQuery();

  // Accumulate pages for cursor-based Load More. `list.data` is always
  // defined under Suspense; `keepPreviousData` holds the previous page
  // while the next one is in flight for dedup.
  const users = useMemo(() => {
    if (!cursor) return list.data.data;
    const seen = new Set(prevPages.map((u) => u.id));
    const fresh = list.data.data.filter((u) => !seen.has(u.id));
    return [...prevPages, ...fresh];
  }, [list.data, cursor, prevPages]);

  const handleLoadMore = useCallback(() => {
    if (list.data.nextCursor) {
      setPrevPages(users);
      setCursor(list.data.nextCursor);
    }
  }, [list.data, users]);

  const hasFilters = !!(urlSearch || urlProjectIds.length || urlStatuses.length);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("heading")}</h1>
          <p className="text-muted-foreground text-sm">{t("subtitle")}</p>
        </div>
        <LastUpdated
          queryKeyPrefix="tracked-users"
          dataUpdatedAt={list.dataUpdatedAt}
          pollIntervalMs={USERS_LIST_POLL_MS}
        />
      </div>

      <StatsStrip data={summary.data} />

      <FilterBar
        search={urlSearch}
        onSearchChange={handleSearchChange}
        projectIds={urlProjectIds}
        onProjectIdsChange={handleProjectIdsChange}
        statuses={urlStatuses}
        onStatusesChange={handleStatusesChange}
      />

      {/*
       * SR-only live region — announces filter/sort/pagination result
       * count changes without surfacing anything to sighted users. The
       * table itself is a static rerender from a screen-reader POV, so
       * without this region the count change (e.g. after applying a
       * status filter) is invisible to assistive tech.
       */}
      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {hasFilters ? t("liveAnnounceFiltered", { count: users.length }) : t("liveAnnounce", { count: users.length })}
      </p>

      {users.length === 0 ? (
        <EmptyState hasFilters={hasFilters} />
      ) : (
        <>
          <UsersTable users={users} sort={urlSort} sortDir={urlSortDir} onSortChange={handleSortChange} />
          {list.data.nextCursor && <LoadMore onClick={handleLoadMore} isLoading={list.isFetching && !!cursor} />}
        </>
      )}
    </div>
  );
}
