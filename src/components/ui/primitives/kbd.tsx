import * as React from "react";

import { cn } from "@/lib/cn";

/** `data-slot="kbd"` is read by `TooltipContent` (`has-data-[slot=kbd]`) for nested-kbd layout. */
function Kbd({ className, ...props }: React.ComponentProps<"kbd">) {
  return (
    <kbd
      data-slot="kbd"
      className={cn(
        "border-border bg-muted/60 text-muted-foreground inline-flex items-center rounded border px-1.5 py-0.5 font-mono text-[0.7rem] leading-none select-all",
        className,
      )}
      {...props}
    />
  );
}

export { Kbd };
