"use client";

import * as React from "react";
import { Select as SelectPrimitive } from "radix-ui";

/**
 * `<div class="contents">` wrap: Radix Select renders a hidden native `<select>`
 * as a sibling to the trigger — without the wrap, the trigger stops being
 * `:last-child` and Tailwind `space-y-*` on outer wrappers picks up an unwanted
 * bottom margin.
 */
function SelectRoot({ ...props }: React.ComponentProps<typeof SelectPrimitive.Root>) {
  return (
    <div data-slot="select" className="contents">
      <SelectPrimitive.Root {...props} />
    </div>
  );
}

export { SelectRoot };
