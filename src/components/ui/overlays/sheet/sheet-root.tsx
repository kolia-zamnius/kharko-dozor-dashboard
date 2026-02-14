"use client";

import * as React from "react";
import { Dialog as SheetPrimitive } from "radix-ui";

/**
 * Radix Dialog primitive, styled as a slide-in sheet (drawer) from an edge.
 *
 * @remarks
 * Compound parts: `SheetTrigger`, `SheetPortal`, `SheetOverlay`,
 * `SheetContent` (accepts `side="top" | "right" | "bottom" | "left"`,
 * auto-injects a Close button with SR-only text), `SheetHeader`,
 * `SheetFooter`, `SheetText` (title/description), `SheetClose`.
 *
 * Under the hood it IS `Radix Dialog` — a sheet is a dialog with
 * different positioning + slide animation. Behavioural contracts
 * (focus trap, Esc, outside click) are identical.
 */
function SheetRoot({ ...props }: React.ComponentProps<typeof SheetPrimitive.Root>) {
  return <SheetPrimitive.Root data-slot="sheet" {...props} />;
}

export { SheetRoot };
