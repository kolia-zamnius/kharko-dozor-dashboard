import * as React from "react";

import { cn } from "@/lib/cn";

/**
 * Card container — padded rounded surface with subtle ring.
 *
 * @remarks
 * Compound parts: `CardHeader`, `CardContent`, `CardFooter`. Size
 * propagates via `data-size` so children pick up compact spacing
 * without a repeated prop. Leading/trailing `<img>` children
 * automatically round to the card's corners.
 */
function CardRoot({
  className,
  size = "default",
  ...props
}: React.ComponentProps<"div"> & { size?: "default" | "sm" }) {
  return (
    <div
      data-slot="card"
      data-size={size}
      className={cn(
        "group/card bg-card text-card-foreground ring-foreground/10 flex flex-col gap-4 overflow-hidden rounded-xl py-4 text-sm ring-1 has-data-[slot=card-footer]:pb-0 has-[>img:first-child]:pt-0 data-[size=sm]:gap-3 data-[size=sm]:py-3 data-[size=sm]:has-data-[slot=card-footer]:pb-0 *:[img:first-child]:rounded-t-xl *:[img:last-child]:rounded-b-xl",
        className,
      )}
      {...props}
    />
  );
}

export { CardRoot };
