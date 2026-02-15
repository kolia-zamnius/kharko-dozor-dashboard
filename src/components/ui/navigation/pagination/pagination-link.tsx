import * as React from "react";

import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/primitives/button";

type PaginationLinkProps = {
  isActive?: boolean;
} & Pick<React.ComponentProps<typeof Button>, "size"> &
  React.ComponentProps<"a">;

function PaginationLink({ className, isActive, size = "icon", ...props }: PaginationLinkProps) {
  return (
    <Button asChild variant={isActive ? "outline" : "ghost"} size={size} className={cn(className)}>
      <a aria-current={isActive ? "page" : undefined} data-slot="pagination-link" data-active={isActive} {...props} />
    </Button>
  );
}

export { PaginationLink, type PaginationLinkProps };
