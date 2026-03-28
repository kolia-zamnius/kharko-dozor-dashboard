import { CalendarBlankIcon } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/primitives/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/overlays/popover";
import { DEFAULT_SESSION_DATE_RANGE, SESSION_DATE_RANGES, type SessionDateRange } from "@/api-client/sessions/domain";
import { DATE_RANGE_KEYS } from "@/app/[locale]/(dashboard)/replays/lib/date-range-ui";
import { cn } from "@/lib/cn";
import { SESSION_RETENTION_DAYS } from "@/lib/time";

type DateRangeFilterProps = {
  selected: SessionDateRange;
  onChange: (range: SessionDateRange) => void;
};

/**
 * Date range filter as a popover with preset buttons.
 * Simple preset selection — no custom date picker needed for
 * a session recording dashboard.
 */
export function DateRangeFilter({ selected, onChange }: DateRangeFilterProps) {
  const t = useTranslations("replays.dateRange");
  const tFilter = useTranslations("replays.list.dateRangeFilter");
  const isDefault = selected === DEFAULT_SESSION_DATE_RANGE;

  // `days` is only consumed by the `"90d"` key's ICU interpolation;
  // passing it on every `t()` call is a no-op for presets that don't
  // reference it (ICU ignores unreferenced variables), and it means
  // changing `SESSION_RETENTION_DAYS` flips the widest-preset label in
  // every locale at once.
  const days = SESSION_RETENTION_DAYS;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <CalendarBlankIcon size={14} />
          {isDefault ? tFilter("default") : t(DATE_RANGE_KEYS[selected], { days })}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-44 p-1">
        {SESSION_DATE_RANGES.map((range) => (
          <button
            key={range}
            type="button"
            onClick={() => onChange(range)}
            className={cn(
              "hover:bg-muted flex w-full items-center rounded-md px-2 py-1.5 text-left text-sm transition-colors",
              selected === range && "bg-muted font-medium",
            )}
          >
            {t(DATE_RANGE_KEYS[range], { days })}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}
