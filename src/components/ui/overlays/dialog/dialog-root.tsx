"use client";

import * as React from "react";
import { Dialog as DialogPrimitive } from "radix-ui";

/**
 * Radix Dialog primitive — modal overlay + focus trap + Esc/outside-click dismissal.
 *
 * @remarks
 * Compound parts: `DialogTrigger`, `DialogPortal`, `DialogOverlay`,
 * `DialogContent` (auto-injects a Close button with SR-only text),
 * `DialogHeader`, `DialogFooter`, `DialogTitle`, `DialogDescription`,
 * `DialogClose`.
 *
 * Per project convention (see `CLAUDE.md`): we use `Dialog` for every
 * modal including destructive confirmations (no separate `AlertDialog`).
 * Modal footers use a plain `<div className="flex justify-end gap-2">`
 * rather than the heavier `DialogFooter` styling.
 */
function DialogRoot({ ...props }: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />;
}

export { DialogRoot };
