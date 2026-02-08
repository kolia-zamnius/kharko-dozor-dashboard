import * as React from "react";

import { cn } from "@/lib/cn";

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-footer"
      className={cn("bg-muted/50 flex items-center rounded-b-xl border-t p-4 group-data-[size=sm]/card:p-3", className)}
      {...props}
    />
  );
}

export { CardFooter };
