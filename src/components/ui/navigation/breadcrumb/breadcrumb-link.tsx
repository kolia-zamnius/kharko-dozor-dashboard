import * as React from "react";
import { Slot } from "radix-ui";

import { cn } from "@/lib/cn";

function BreadcrumbLink({
  asChild,
  className,
  ...props
}: React.ComponentProps<"a"> & {
  asChild?: boolean;
}) {
  const Comp = asChild ? Slot.Root : "a";

  return (
    <Comp data-slot="breadcrumb-link" className={cn("hover:text-foreground transition-colors", className)} {...props} />
  );
}

export { BreadcrumbLink };
