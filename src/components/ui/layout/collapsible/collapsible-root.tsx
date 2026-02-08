"use client";

import * as React from "react";
import { Collapsible as CollapsiblePrimitive } from "radix-ui";

/**
 * Radix Collapsible primitive — show/hide toggle with animated height.
 *
 * @remarks
 * Compound parts: `CollapsibleTrigger` + `CollapsibleContent`. Use
 * when you need raw toggle behaviour without any of the dropdown /
 * dialog / sheet affordances.
 */
function CollapsibleRoot({ ...props }: React.ComponentProps<typeof CollapsiblePrimitive.Root>) {
  return <CollapsiblePrimitive.Root data-slot="collapsible" {...props} />;
}

export { CollapsibleRoot };
