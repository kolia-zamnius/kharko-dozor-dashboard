"use client";

import * as React from "react";
import { DropdownMenu as DropdownMenuPrimitive } from "radix-ui";

/**
 * Radix DropdownMenu primitive — click-to-open contextual menu with full keyboard support.
 *
 * @remarks
 * Compound parts: `DropdownMenuTrigger`, `DropdownMenuPortal`,
 * `DropdownMenuContent`, `DropdownMenuItem`, `DropdownMenuGroup`,
 * `DropdownMenuLabel`, `DropdownMenuSeparator`, `DropdownMenuShortcut`,
 * `DropdownMenuCheckboxItem`, `DropdownMenuRadioGroup` +
 * `DropdownMenuRadioItem`, `DropdownMenuSub` + `DropdownMenuSubTrigger`
 * + `DropdownMenuSubContent`.
 *
 * Use for action menus (`⋮` row menu, org switcher, user profile).
 * For a visible list of options, prefer `Select`.
 */
function DropdownMenuRoot({ ...props }: React.ComponentProps<typeof DropdownMenuPrimitive.Root>) {
  return <DropdownMenuPrimitive.Root data-slot="dropdown-menu" {...props} />;
}

export { DropdownMenuRoot };
