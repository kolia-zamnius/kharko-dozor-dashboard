"use client";

import * as React from "react";
import { Dialog as SheetPrimitive } from "radix-ui";

function SheetTrigger({ ...props }: React.ComponentProps<typeof SheetPrimitive.Trigger>) {
  return <SheetPrimitive.Trigger data-slot="sheet-trigger" {...props} />;
}

export { SheetTrigger };
