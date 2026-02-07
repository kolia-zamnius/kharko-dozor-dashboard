"use client";

import * as React from "react";
import { Select as SelectPrimitive } from "radix-ui";

/**
 * Radix Select primitive — wrapped in a `display: contents` div.
 *
 * @remarks
 * Radix Select injects a hidden native `<select aria-hidden="true">`
 * (the `SelectBubbleInput`) as a DOM sibling to the visible trigger:
 *
 *   <button data-slot="select-trigger">…</button>
 *   <select aria-hidden="true">…</select>
 *
 * Two DOM children break Tailwind `space-y-*` on outer form wrappers
 * (`> :not(:last-child) { margin-bottom }`): the visible trigger stops
 * being `:last-child` and picks up an unwanted bottom margin,
 * shifting off the baseline of sibling `Input` / `Button`.
 *
 * Wrapping the Root in `<div class="contents">` collapses both nodes
 * into one from the outer wrapper's POV. `display: contents` keeps
 * the element in the DOM tree (so `:last-child` works) but removes
 * it from the layout tree — layout is unchanged, but `space-y-*` now
 * sees one "Select" child. Fix lives here so no call site has to
 * remember.
 *
 * Compound parts: `SelectTrigger`, `SelectContent`, `SelectItem`,
 * `SelectValue`, `SelectGroup`, `SelectLabel`, `SelectSeparator`,
 * `SelectScrollUpButton` / `SelectScrollDownButton`.
 */
function SelectRoot({ ...props }: React.ComponentProps<typeof SelectPrimitive.Root>) {
  return (
    <div data-slot="select" className="contents">
      <SelectPrimitive.Root {...props} />
    </div>
  );
}

export { SelectRoot };
