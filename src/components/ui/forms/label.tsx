"use client";

import * as React from "react";
import { Label as LabelPrimitive } from "radix-ui";

import { cn } from "@/lib/cn";

/**
 * Radix Label primitive — form label associated with a sibling control via `htmlFor`.
 *
 * @remarks
 * Deliberately drops shadcn's default `flex items-center gap-2`:
 *   - Every Label in this codebase associates to a **sibling** control
 *     via `htmlFor`, not a nested child.
 *   - The flex default turns every inline text run (like `<span>`
 *     inside confirmation copy) into its own flex item, adding 8px
 *     of phantom gap between runs.
 *
 * Opt back into flex-with-icon via `className="flex items-center gap-2"`
 * on the specific call site.
 */
function Label({ className, ...props }: React.ComponentProps<typeof LabelPrimitive.Root>) {
  return (
    <LabelPrimitive.Root
      data-slot="label"
      className={cn(
        "block text-sm leading-none font-medium select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export { Label };
