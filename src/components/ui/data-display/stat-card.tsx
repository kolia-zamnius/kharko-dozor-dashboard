import type { ReactNode } from "react";

import { Card, CardContent } from "@/components/ui/layout/card";
import { cn } from "@/lib/cn";

type StatCardProps = {
  label: string;
  value: ReactNode;
  /** Optional secondary line below the value. Truncated if too long. */
  sub?: ReactNode;
  /** Optional leading icon rendered next to the label. */
  icon?: ReactNode;
  className?: string;
};

/**
 * Compact metric card — activity-summary numbers in a grid.
 *
 * @remarks
 * Visual hierarchy: `value` is the big number, `label` is muted +
 * small, `sub` carries optional context (e.g. a truncated top-page
 * pathname). All text columns truncate rather than wrap.
 */
export function StatCard({ label, value, sub, icon, className }: StatCardProps) {
  return (
    <Card size="sm" className={cn("hover:bg-muted/30 transition-colors", className)}>
      <CardContent className="py-1">
        <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
          {icon}
          <span className="truncate">{label}</span>
        </div>
        <div className="font-heading mt-1 text-xl leading-tight font-semibold tabular-nums">{value}</div>
        {sub ? <div className="text-muted-foreground mt-0.5 truncate text-xs">{sub}</div> : null}
      </CardContent>
    </Card>
  );
}
