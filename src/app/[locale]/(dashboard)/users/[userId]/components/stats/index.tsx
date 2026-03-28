import { ClockIcon, CursorClickIcon, GaugeIcon, MapPinIcon, PlayCircleIcon, TrendUpIcon } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";

import type { UserActivity } from "@/api-client/tracked-users/types";
import { type ActivityRange } from "@/api-client/tracked-users/domain";
import { useFormatters } from "@/lib/use-formatters";
import { StatCard } from "@/components/ui/data-display/stat-card";

type UserStatsProps = {
  data: UserActivity;
  range: ActivityRange;
};

/**
 * Metric grid driven by the activity summary.
 *
 * Pure view — the parent (`UserDetailShell`) hoists `useUserActivityQuery`
 * and passes `data` down as a prop, so this component never reads from
 * the query client directly. Under the hood the shell's query is the
 * same one that powers `ActivityChart` and `PageDistribution` (one key,
 * three consumers, one network request).
 *
 * Layout: 2 cols on mobile → 3 on sm → 6 on xl. Two rows on most screens.
 */
export function UserStats({ data, range }: UserStatsProps) {
  const t = useTranslations("users.detail.stats");
  const tActivity = useTranslations("users.activity");
  const { formatCount, formatDuration } = useFormatters();
  const rangeLabel = tActivity(`${range}.label`).toLowerCase();
  const s = data.summary;
  const hasActivity = s.sessionCount > 0;

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
      <StatCard
        icon={<PlayCircleIcon weight="regular" />}
        label={t("sessions")}
        value={formatCount(s.sessionCount)}
        sub={rangeLabel}
      />
      <StatCard
        icon={<ClockIcon weight="regular" />}
        label={t("activeTime")}
        value={hasActivity ? formatDuration(s.totalActiveTime) : t("dash")}
        sub={rangeLabel}
      />
      <StatCard
        icon={<GaugeIcon weight="regular" />}
        label={t("avgSession")}
        value={hasActivity ? formatDuration(s.avgSessionDuration) : t("dash")}
        sub={hasActivity ? t("across", { count: s.sessionCount }) : t("noSessions")}
      />
      <StatCard
        icon={<CursorClickIcon weight="regular" />}
        label={t("events")}
        value={formatCount(s.totalEvents)}
        sub={rangeLabel}
      />
      <StatCard
        icon={<MapPinIcon weight="regular" />}
        label={t("uniquePages")}
        value={formatCount(s.uniquePages)}
        sub={rangeLabel}
      />
      <StatCard
        icon={<TrendUpIcon weight="regular" />}
        label={t("topPage")}
        value={
          s.topPage ? (
            <span className="font-mono text-sm font-medium" title={s.topPage}>
              {s.topPage}
            </span>
          ) : (
            t("dash")
          )
        }
        sub={s.topPage ? t("topPageSub") : rangeLabel}
      />
    </div>
  );
}
