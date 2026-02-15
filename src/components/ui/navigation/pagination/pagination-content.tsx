import * as React from "react";

import { cn } from "@/lib/cn";

function PaginationContent({ className, ...props }: React.ComponentProps<"ul">) {
  return <ul data-slot="pagination-content" className={cn("flex items-center gap-0.5", className)} {...props} />;
}

export { PaginationContent };
