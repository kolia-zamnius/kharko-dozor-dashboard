import * as React from "react";

import { cn } from "@/lib/cn";

/**
 * Table container — semantic `<table>` wrapped in a horizontally scrollable div.
 *
 * @remarks
 * Compound parts: `TableHeader`, `TableBody`, `TableFooter`,
 * `TableRow`, `TableHead` (`<th>`), `TableCell` (`<td>`),
 * `TableCaption`. The outer `overflow-x-auto` div lets the table
 * handle narrow viewports without breaking column alignment.
 */
function TableRoot({ className, ...props }: React.ComponentProps<"table">) {
  return (
    <div data-slot="table-container" className="relative w-full overflow-x-auto">
      <table data-slot="table" className={cn("w-full caption-bottom text-sm", className)} {...props} />
    </div>
  );
}

export { TableRoot };
