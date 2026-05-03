import { useTranslations } from "next-intl";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/layout/card";
import type { UserActivity } from "@/api-client/tracked-users/types";
import { type ActivityRange } from "@/api-client/tracked-users/domain";
import { ActivityHistogram } from "./histogram";

type ActivityChartProps = {
  data: UserActivity;
  range: ActivityRange;
};

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
