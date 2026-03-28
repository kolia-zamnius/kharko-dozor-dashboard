import { useTranslations } from "next-intl";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useTransition } from "react";

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/primitives/toggle-group";
import { ACTIVITY_RANGES, parseActivityRange } from "@/api-client/tracked-users/domain";

/**
 * Page-level range selector for the user detail page.
 *
 * Lives at the top of the page next to `LastUpdated` — range affects every
 * section below (stats, histogram, page distribution, sessions timeline),
 * so it belongs at the page level rather than inside any single card.
 *
 * Reads and writes `?range=6h|24h|7d` directly via `useSearchParams` +
 * `router.replace(..., { scroll: false })`. No props, no prop drilling —
 * the shell already re-derives `range` from `useSearchParams` and passes it
 * to consumers, so wiring this component through the URL keeps a single
 * source of truth.
 *
 * `useTransition` wraps the router update so React can keep the page
 * responsive while the downstream queries refetch. The actual "refreshing"
 * visual is handled by the `LastUpdated` indicator right next to us.
 */
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
      // Radix ToggleGroup emits an empty string when the user deselects
      // the current item; we force a selection via `value`, so this guard
      // is just belt-and-braces.
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
