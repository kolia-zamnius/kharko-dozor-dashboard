import * as React from "react";

import { cn } from "@/lib/cn";

function BreadcrumbItem({ className, ...props }: React.ComponentProps<"li">) {
  return <li data-slot="breadcrumb-item" className={cn("inline-flex items-center gap-1", className)} {...props} />;
}

export { BreadcrumbItem };
