import * as React from "react";

import { cn } from "@/lib/cn";

function BreadcrumbRoot({ className, ...props }: React.ComponentProps<"nav">) {
  return <nav aria-label="breadcrumb" data-slot="breadcrumb" className={cn(className)} {...props} />;
}

export { BreadcrumbRoot };
