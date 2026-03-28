"use client";

import { useTranslations } from "next-intl";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useMemo, useState } from "react";

import { LastUpdated } from "@/components/last-updated";
import { Spinner } from "@/components/ui/feedback/spinner";
import {
  DEFAULT_SESSION_DATE_RANGE,
  parseSessionDateRange,
  parseSessionListSortBy,
  parseSessionListSortDir,
  SESSIONS_LIST_POLL_MS,
  type SessionDateRange,
  type SessionListSortBy,
  type SessionListSortDir,
} from "@/api-client/sessions/domain";
import { useSessionsSummarySuspenseQuery, useSessionsSuspenseQuery } from "@/api-client/sessions/queries";
import type { SessionListItem } from "@/api-client/sessions/types";
import { useCanManageActiveOrg } from "@/lib/hooks/use-can-manage-active-org";
import { EmptyState } from "./empty-state";
import { FilterBar } from "./filter-bar";
import { LoadMore } from "./load-more";
import { StatsStrip } from "./stats-strip";
import { SessionsTable } from "./sessions-table";

/**
 * Composition root for the `/replays` page.
 *
 * @remarks
 * Implements the **"URL-driven list shell"** pattern — the same shape
 * shared with {@link UsersListShell}. Both shells:
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
 * Additional concern unique to this shell: it derives `canManage`
 * from the active-org role and threads it to `<SessionsTable>` so the
 * per-row delete control only renders for OWNER/ADMIN. The underlying
 * `DELETE /api/sessions/[id]` is ADMIN-guarded regardless (RBAC
 * double-validation).
 *
 * See `UsersListShell` JSDoc for the rule-of-3 deferral rationale
 * behind the ~38 % duplication between the two shells.
 *
 * @see ../../users/components/users-list-shell.tsx — sibling shell.
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

  // Shared role-derivation hook — see `useCanManageActiveOrg` JSDoc.
  const canManage = useCanManageActiveOrg();

  // ── URL-driven filter state ──────────────────────────────────────────
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
    // Keep the URL clean when the user picks the default preset — no
    // `?range=90d` noise, symmetric with how `sort` / `dir` handle defaults
    // above.
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

  // ── Cursor pagination ────────────────────────────────────────────────
  const [cursor, setCursor] = useState<string | undefined>();
  const [prevPages, setPrevPages] = useState<SessionListItem[]>([]);

  const filterKey = `${urlSearch}|${urlProjectIds.join(",")}|${urlDateRange}|${urlSort}|${urlSortDir}`;
  const [prevFilterKey, setPrevFilterKey] = useState(filterKey);
  if (prevFilterKey !== filterKey) {
    setPrevFilterKey(filterKey);
    setCursor(undefined);
    setPrevPages([]);
  }

  // ── Queries ──────────────────────────────────────────────────────────
  // Suspense queries: Suspense boundary above handled the initial load;
  // subsequent cursor / filter changes flow through `placeholderData:
  // keepPreviousData` in the query options — the table keeps the old
  // page until the new one lands.
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

  // Accumulate pages for cursor-based Load More. `list.data` is always
  // defined under Suspense, so we can drop the `!list.data` guard.
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

      {/*
       * SR-only live region — see the matching comment in
       * `users-list-shell.tsx`. Announces filter/sort/pagination result
       * count changes to assistive tech without any sighted-user UI.
       */}
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
