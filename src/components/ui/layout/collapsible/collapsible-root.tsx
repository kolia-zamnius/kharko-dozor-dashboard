"use client";

import * as React from "react";
import { Collapsible as CollapsiblePrimitive } from "radix-ui";

function CollapsibleRoot({ ...props }: React.ComponentProps<typeof CollapsiblePrimitive.Root>) {
  return <CollapsiblePrimitive.Root data-slot="collapsible" {...props} />;
}

export { CollapsibleRoot };
