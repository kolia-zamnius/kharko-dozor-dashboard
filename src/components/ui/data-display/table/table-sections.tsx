import * as React from "react";

import { cn } from "@/lib/cn";

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  // `[&_tr:hover]:bg-transparent` cancels TableRow's default hover —
  // wins on specificity (parent-child selector beats row's plain one).
  return (
    <thead
      data-slot="table-header"
      className={cn("bg-muted/40 [&_tr]:border-b [&_tr:hover]:bg-transparent", className)}
      {...props}
    />
  );
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return <tbody data-slot="table-body" className={cn("[&_tr:last-child]:border-0", className)} {...props} />;
}

function TableFooter({ className, ...props }: React.ComponentProps<"tfoot">) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn("bg-muted/50 border-t font-medium [&>tr]:last:border-b-0", className)}
      {...props}
    />
  );
}

export { TableBody, TableFooter, TableHeader };
