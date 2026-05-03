import * as React from "react";

import { cn } from "@/lib/cn";

/**
 * Pure CSS so it works in `loading.tsx` Server Components (icon-lib imports fail
 * there). Pass `aria-hidden` when the container already has a label (submit
 * button with text) — avoids screen-reader double-talk.
 */
function Spinner({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      role="status"
      aria-label="Loading"
      data-slot="spinner"
      className={cn(
        "text-muted-foreground size-6 animate-spin rounded-full border-2 border-current/20 border-t-current",
        className,
      )}
      {...props}
    />
  );
}

export { Spinner };
