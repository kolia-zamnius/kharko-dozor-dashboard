"use client";

import * as React from "react";
import { Separator as SeparatorPrimitive } from "radix-ui";

import { cn } from "@/lib/cn";

/**
 * Radix Separator primitive — 1px horizontal or vertical divider.
 *
 * @remarks
 * Defaults to `decorative={true}` (hidden from the accessibility tree).
 * Pass `decorative={false}` when the separator genuinely splits logical
 * regions — screen readers will then announce it as a role separator.
 */
function Separator({
  className,
  orientation = "horizontal",
  decorative = true,
  ...props
}: React.ComponentProps<typeof SeparatorPrimitive.Root>) {
  return (
    <SeparatorPrimitive.Root
      data-slot="separator"
      decorative={decorative}
      orientation={orientation}
      className={cn(
        "bg-border shrink-0 data-horizontal:h-px data-horizontal:w-full data-vertical:w-px data-vertical:self-stretch",
        className,
      )}
      {...props}
    />
  );
}

export { Separator };
