import * as React from "react";

import { cn } from "@/lib/cn";

/**
 * Inline keyboard-or-code chip primitive — IDs, shortcuts, tokens in prose.
 *
 * @remarks
 * `select-all` means a single click selects the whole contents for
 * easy copy-paste — the dominant interaction for an ID badge.
 * `data-slot="kbd"` is targeted by `TooltipContent` for nested-kbd
 * layout tweaks (see `tooltip.tsx`).
 */
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
