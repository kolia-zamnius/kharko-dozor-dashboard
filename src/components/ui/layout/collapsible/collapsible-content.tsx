"use client";

import * as React from "react";
import { Collapsible as CollapsiblePrimitive } from "radix-ui";

import { cn } from "@/lib/cn";

function CollapsibleContent({ className, ...props }: React.ComponentProps<typeof CollapsiblePrimitive.Content>) {
  return (
    <CollapsiblePrimitive.Content
      data-slot="collapsible-content"
      className={cn(
        "data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down overflow-hidden",
        className,
      )}
      {...props}
    />
  );
}

export { CollapsibleContent };
