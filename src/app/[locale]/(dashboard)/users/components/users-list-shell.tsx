"use client";

import { useTranslations } from "next-intl";
// next-intl has no locale-aware `useSearchParams` — read raw from `next/navigation`.
// `useRouter` IS locale-aware so empty-query clears land on `/{locale}/users`.
import { useSearchParams } from "next/navigation";
import { useRouter } from "@/i18n/navigation";
import { Suspense, useCallback, useMemo } from "react";

import { LastUpdated } from "@/components/last-updated";
import { Spinner } from "@/components/ui/feedback/spinner";
import {
  parseUserListSortBy,
  parseUserListSortDir,
  type UserListSortBy,
  type UserListSortDir,
} from "@/api-client/tracked-users/domain";
import { USERS_LIST_POLL_MS } from "@/api-client/tracked-users/constants";
import {
  useTrackedUsersSummarySuspenseQuery,
  useTrackedUsersSuspenseInfiniteQuery,
} from "@/api-client/tracked-users/queries";
import type { UserActivityStatus } from "@/api-client/tracked-users/domain";
import { flattenCursorPages } from "@/api-client/_lib/pagination";
import { EmptyState } from "./empty-state";
import { FilterBar } from "./filter-bar";
import { LoadMore } from "./load-more";
import { StatsStrip } from "./stats-strip";
import { UsersTable } from "./users-table";

/**
 * URL-driven list shell — paired with `SessionsListShell`. Page accumulation +
 * load-more come from `useSuspenseInfiniteQuery`; only the filter DTO differs
 * between the two shells (`statuses` vs `range`), the pagination plumbing is
 * uniform.
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

  const listParams = useMemo(
    () => ({
      search: urlSearch || undefined,
      projectIds: urlProjectIds.length ? urlProjectIds : undefined,
      statuses: urlStatuses.length ? urlStatuses : undefined,
      sort: urlSort !== "last-seen" ? urlSort : undefined,
      sortDir: urlSortDir !== "desc" ? urlSortDir : undefined,
    }),
    [urlSearch, urlProjectIds, urlStatuses, urlSort, urlSortDir],
  );

  const list = useTrackedUsersSuspenseInfiniteQuery(listParams);
  const summary = useTrackedUsersSummarySuspenseQuery();

  const users = useMemo(() => flattenCursorPages(list.data.pages), [list.data.pages]);

  const handleLoadMore = useCallback(() => {
    if (list.hasNextPage && !list.isFetchingNextPage) void list.fetchNextPage();
  }, [list]);

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

      {/* SR-only — table re-render is silent to assistive tech without this region. */}
      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {hasFilters ? t("liveAnnounceFiltered", { count: users.length }) : t("liveAnnounce", { count: users.length })}
      </p>

      {users.length === 0 ? (
        <EmptyState hasFilters={hasFilters} />
      ) : (
        <>
          <UsersTable users={users} sort={urlSort} sortDir={urlSortDir} onSortChange={handleSortChange} />
          {list.hasNextPage && <LoadMore onClick={handleLoadMore} isLoading={list.isFetchingNextPage} />}
        </>
      )}
    </div>
  );
}
