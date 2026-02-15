import * as React from "react";

import { cn } from "@/lib/cn";

/**
 * Breadcrumb landmark — `<nav aria-label="breadcrumb">`.
 *
 * @remarks
 * Compound parts: `BreadcrumbList`, `BreadcrumbItem`, `BreadcrumbLink`
 * (accepts `asChild` for `next/link`), `BreadcrumbPage` (the current,
 * non-clickable segment), `BreadcrumbSeparator`, `BreadcrumbEllipsis`.
 */
function BreadcrumbRoot({ className, ...props }: React.ComponentProps<"nav">) {
  return <nav aria-label="breadcrumb" data-slot="breadcrumb" className={cn(className)} {...props} />;
}

export { BreadcrumbRoot };
