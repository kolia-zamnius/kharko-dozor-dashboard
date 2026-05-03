"use client";

import * as React from "react";
import { ToggleGroup as ToggleGroupPrimitive } from "radix-ui";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/cn";

const toggleGroupVariants = cva("inline-flex items-center rounded-lg border border-border bg-background p-0.5", {
  variants: {
    size: {
      default: "h-9",
      sm: "h-8",
    },
  },
  defaultVariants: { size: "default" },
});

const toggleGroupItemVariants = cva(
  "inline-flex h-full shrink-0 cursor-pointer items-center justify-center rounded-md px-3 text-sm font-medium whitespace-nowrap transition-colors outline-none select-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:shadow-sm data-[state=on]:hover:bg-primary [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      size: {
        default: "gap-1.5 px-3 text-sm",
        sm: "gap-1 px-2.5 text-[0.8rem]",
      },
    },
    defaultVariants: { size: "default" },
  },
);

type ToggleGroupContextValue = VariantProps<typeof toggleGroupItemVariants>;
const ToggleGroupContext = React.createContext<ToggleGroupContextValue>({ size: "default" });

type ToggleGroupProps = React.ComponentProps<typeof ToggleGroupPrimitive.Root> &
  VariantProps<typeof toggleGroupVariants>;
type ToggleGroupItemProps = React.ComponentProps<typeof ToggleGroupPrimitive.Item> &
  VariantProps<typeof toggleGroupItemVariants>;

function ToggleGroup({ className, size = "default", children, ...props }: ToggleGroupProps) {
  return (
    <ToggleGroupPrimitive.Root
      data-slot="toggle-group"
      data-size={size}
      className={cn(toggleGroupVariants({ size, className }))}
      {...props}
    >
      <ToggleGroupContext.Provider value={{ size }}>{children}</ToggleGroupContext.Provider>
    </ToggleGroupPrimitive.Root>
  );
}

function ToggleGroupItem({ className, children, size: sizeProp, ...props }: ToggleGroupItemProps) {
  const ctx = React.useContext(ToggleGroupContext);
  const size = sizeProp ?? ctx.size;
  return (
    <ToggleGroupPrimitive.Item
      data-slot="toggle-group-item"
      data-size={size}
      className={cn(toggleGroupItemVariants({ size, className }))}
      {...props}
    >
      {children}
    </ToggleGroupPrimitive.Item>
  );
}

export { ToggleGroup, ToggleGroupItem, toggleGroupVariants, toggleGroupItemVariants };
export type { ToggleGroupProps, ToggleGroupItemProps };
