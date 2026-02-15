import * as React from "react";

import { cn } from "@/lib/cn";

/**
 * Pagination navigation landmark — `<nav aria-label="pagination">`.
 *
 * @remarks
 * Compound parts: `PaginationContent` (the `<ul>`), `PaginationItem`
 * (the `<li>`), `PaginationLink` (styled as a `Button asChild`),
 * `PaginationPrevious` + `PaginationNext`, `PaginationEllipsis`.
 * Purely presentational — pagination logic (cursor, page number)
 * lives in the consumer's state.
 */
function PaginationRoot({ className, ...props }: React.ComponentProps<"nav">) {
  return (
    <nav
      role="navigation"
      aria-label="pagination"
      data-slot="pagination"
      className={cn("mx-auto flex w-full justify-center", className)}
      {...props}
    />
  );
}

export { PaginationRoot };
