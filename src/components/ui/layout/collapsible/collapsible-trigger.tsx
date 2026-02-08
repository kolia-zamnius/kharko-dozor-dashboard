"use client";

import * as React from "react";
import { Collapsible as CollapsiblePrimitive } from "radix-ui";

function CollapsibleTrigger({ ...props }: React.ComponentProps<typeof CollapsiblePrimitive.Trigger>) {
  return <CollapsiblePrimitive.Trigger data-slot="collapsible-trigger" {...props} />;
}

export { CollapsibleTrigger };
