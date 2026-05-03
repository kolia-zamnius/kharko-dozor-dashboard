import { useTranslations } from "next-intl";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useTransition } from "react";

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/primitives/toggle-group";
import { ACTIVITY_RANGES, parseActivityRange } from "@/api-client/tracked-users/domain";

/** URL-driven (no props) — shell re-derives `range` from `useSearchParams`. `useTransition` keeps the page responsive while downstream queries refetch. */
export function RangeSelector() {
  const t = useTranslations("users");
  const tActivity = useTranslations("users.activity");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const currentRange = parseActivityRange(searchParams?.get("range"));

  const handleRangeChange = useCallback(
    (value: string) => {
      // Radix emits "" on deselect — controlled `value` prevents it, but belt-and-braces.
      if (!value) return;
      const next = parseActivityRange(value);
      if (next === currentRange) return;

      const params = new URLSearchParams(searchParams?.toString() ?? "");
      params.set("range", next);
      startTransition(() => {
        router.replace(`${pathname}?${params.toString()}`, { scroll: false });
      });
    },
    [currentRange, pathname, router, searchParams],
  );

  return (
    <ToggleGroup
      type="single"
      size="sm"
      value={currentRange}
      onValueChange={handleRangeChange}
      aria-label={t("detail.rangeSelectorAria")}
    >
      {ACTIVITY_RANGES.map((r) => (
        <ToggleGroupItem key={r} value={r} disabled={isPending}>
          {tActivity(`${r}.shortLabel`)}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
