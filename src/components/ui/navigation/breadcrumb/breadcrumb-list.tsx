import * as React from "react";

import { cn } from "@/lib/cn";

function BreadcrumbList({ className, ...props }: React.ComponentProps<"ol">) {
  return (
    <ol
      data-slot="breadcrumb-list"
      className={cn("text-muted-foreground flex flex-wrap items-center gap-1.5 text-sm wrap-break-word", className)}
      {...props}
    />
  );
}

export { BreadcrumbList };
