import { ClockIcon, LightningIcon, PlayIcon, TimerIcon } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";

import { StatCard } from "@/components/ui/data-display/stat-card";
import type { SessionsSummary } from "@/api-client/sessions/types";
import { useFormatters } from "@/lib/use-formatters";

type StatsStripProps = {
  data: SessionsSummary;
};

/**
 * Four KPI cards at the top of the replays list page.
 *
 * Pure view — data comes from the parent shell. Layout: 2 cols on mobile,
 * 4 on sm+. Mirrors the users page stats strip pattern.
 */
export function StatsStrip({ data }: StatsStripProps) {
  const t = useTranslations("replays.list.stats");
  const { formatCount, formatDuration } = useFormatters();
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <StatCard
        icon={<PlayIcon weight="regular" />}
        label={t("totalSessions")}
        value={formatCount(data.totalSessions)}
      />
      <StatCard
        icon={<ClockIcon weight="regular" />}
        label={t("totalDuration")}
        value={data.totalDuration > 0 ? formatDuration(data.totalDuration) : t("dash")}
      />
      <StatCard
        icon={<TimerIcon weight="regular" />}
        label={t("avgDuration")}
        value={data.avgDuration > 0 ? formatDuration(data.avgDuration) : t("dash")}
      />
      <StatCard
        icon={<LightningIcon weight="regular" />}
        label={t("activeToday")}
        value={formatCount(data.activeToday)}
      />
    </div>
  );
}
