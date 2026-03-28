import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/primitives/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/layout/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/data-display/table";
import type { UserActivity } from "@/api-client/tracked-users/types";
import { PAGE_DISTRIBUTION_INITIAL, PAGE_DISTRIBUTION_STEP } from "@/api-client/tracked-users/domain";
import { colorClassForPathname } from "../lib/page-colors";
import { cn } from "@/lib/cn";
import { useFormatters } from "@/lib/use-formatters";

type PageDistributionProps = {
  data: UserActivity;
  pageLimit: number;
  onShowMore: () => void;
  onShowLess: () => void;
};

/**
 * Dense ranked list of pathnames the tracked user visited in the selected
 * range, sorted by time spent.
 *
 * Pure view — `UserDetailShell` hoists `useUserActivityQuery` and hands
 * `data` down as a prop. This component shares the data with `UserStats`
 * and `ActivityHistogram` under the same query key; the shell renders
 * all three with the same `data` reference.
 *
 * Pagination: server-side, growth-based. `pageLimit` is owned by the shell
 * and included in the query key. Clicking "Show more" bumps `pageLimit`
 * there, which changes the key and triggers a refetch; `keepPreviousData`
 * on the query means the current rows stay visible while page 2 lands.
 * `summary.uniquePages` carries the true total so we always know when
 * everything is visible.
 */
export function PageDistribution({ data, pageLimit, onShowMore, onShowLess }: PageDistributionProps) {
  const t = useTranslations("users.detail.pages");
  const { formatCount, formatDuration } = useFormatters();
  const visiblePages = data.pageDistribution;
  const totalUnique = data.summary.uniquePages;

  if (visiblePages.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t("title")}</CardTitle>
        </CardHeader>
        <CardContent className="pb-5">
          <p className="text-muted-foreground py-6 text-center text-sm">{t("empty")}</p>
        </CardContent>
      </Card>
    );
  }

  // How many rows the next "Show more" click would actually add. On the
  // last page this caps at the real remainder instead of always saying 10.
  const remaining = Math.max(0, totalUnique - visiblePages.length);
  const nextMoreCount = Math.min(PAGE_DISTRIBUTION_STEP, remaining);
  const hasMore = nextMoreCount > 0;

  // "Show less" appears as soon as the user has expanded past the initial
  // page — decrements by the same step, floored at the initial count.
  const canShowLess = pageLimit > PAGE_DISTRIBUTION_INITIAL;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <CardAction>
          <span className="text-muted-foreground text-xs tabular-nums">
            {t("countLabel", { visible: visiblePages.length, total: formatCount(totalUnique) })}
          </span>
        </CardAction>
      </CardHeader>
      <CardContent className="pb-5">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-muted-foreground w-8">{t("colNum")}</TableHead>
              <TableHead>{t("colPage")}</TableHead>
              <TableHead className="text-right">{t("colTime")}</TableHead>
              <TableHead className="text-right">{t("colShare")}</TableHead>
              <TableHead className="text-right">{t("colVisits")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visiblePages.map((page, i) => {
              const sharePct = Math.round(page.share * 100);
              return (
                <TableRow key={page.pathname}>
                  <TableCell className="text-muted-foreground text-xs tabular-nums">{i + 1}</TableCell>
                  <TableCell>
                    <div className="flex min-w-0 items-center gap-2">
                      <span
                        aria-hidden
                        className={cn("size-2 shrink-0 rounded-full", colorClassForPathname(page.pathname))}
                      />
                      <span className="truncate font-mono text-sm" title={page.pathname}>
                        {page.pathname}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right text-sm tabular-nums">{formatDuration(page.duration)}</TableCell>
                  <TableCell className="text-muted-foreground text-right text-sm tabular-nums">{sharePct}%</TableCell>
                  <TableCell className="text-muted-foreground text-right text-sm tabular-nums">
                    {formatCount(page.visits)}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>

        {(hasMore || canShowLess) && (
          <div className="mt-3 flex justify-center gap-2">
            {canShowLess && (
              <Button variant="ghost" size="sm" onClick={onShowLess}>
                {t("showLess", { count: PAGE_DISTRIBUTION_STEP })}
              </Button>
            )}
            {hasMore && (
              <Button variant="ghost" size="sm" onClick={onShowMore}>
                {t("showMore", { count: nextMoreCount })}
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
