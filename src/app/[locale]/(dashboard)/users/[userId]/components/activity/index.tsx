import { useTranslations } from "next-intl";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/layout/card";
import type { UserActivity } from "@/api-client/tracked-users/types";
import { type ActivityRange } from "@/api-client/tracked-users/domain";
import { ActivityHistogram } from "./histogram";

type ActivityChartProps = {
  data: UserActivity;
  range: ActivityRange;
};

/**
 * Container for the event histogram.
 *
 * Pure view — loading/error branches live in `UserDetailShell` (which
 * hoists `useUserActivityQuery` and gates the whole page on a single
 * spinner). Here we just render the histogram for whatever `data` the
 * shell hands us.
 *
 * No longer owns the range selector — that was lifted to the page-level
 * `<RangeSelector>` in the top bar (next to `<LastUpdated>`) because the
 * range affects every section on the page, not just this chart.
 */
export function ActivityChart({ data, range }: ActivityChartProps) {
  const t = useTranslations("users.detail.activityChart");
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
      </CardHeader>
      <CardContent className="pb-5">
        <ActivityHistogram data={data} range={range} />
      </CardContent>
    </Card>
  );
}
