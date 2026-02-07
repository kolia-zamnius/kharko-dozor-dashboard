"use client";

import * as React from "react";
import { Select as SelectPrimitive } from "radix-ui";

import { cn } from "@/lib/cn";

function SelectLabel({ className, ...props }: React.ComponentProps<typeof SelectPrimitive.Label>) {
  return (
    <SelectPrimitive.Label
      data-slot="select-label"
      className={cn("text-muted-foreground px-1.5 py-1 text-xs", className)}
      {...props}
    />
  );
}

export { SelectLabel };
