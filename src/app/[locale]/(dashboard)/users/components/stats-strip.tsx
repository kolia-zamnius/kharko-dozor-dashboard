import { ChartLineUpIcon, LightningIcon, UsersIcon, WifiHighIcon } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";

import { StatCard } from "@/components/ui/data-display/stat-card";
import type { TrackedUsersSummary } from "@/api-client/tracked-users/schemas";
import { useFormatters } from "@/lib/use-formatters";

type StatsStripProps = {
  data: TrackedUsersSummary;
};

export function StatsStrip({ data }: StatsStripProps) {
  const t = useTranslations("users.list.stats");
  const { formatCount } = useFormatters();
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <StatCard icon={<UsersIcon weight="regular" />} label={t("totalTracked")} value={formatCount(data.total)} />
      <StatCard icon={<WifiHighIcon weight="regular" />} label={t("onlineNow")} value={formatCount(data.onlineNow)} />
      <StatCard icon={<LightningIcon weight="regular" />} label={t("active24h")} value={formatCount(data.active24h)} />
      <StatCard
        icon={<ChartLineUpIcon weight="regular" />}
        label={t("newThisWeek")}
        value={formatCount(data.newThisWeek)}
      />
    </div>
  );
}
