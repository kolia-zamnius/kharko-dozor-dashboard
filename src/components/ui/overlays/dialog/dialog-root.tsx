"use client";

import * as React from "react";
import { Dialog as DialogPrimitive } from "radix-ui";

/**
 * Used for every modal including destructive confirms — no separate `AlertDialog`.
 * Modal forms typically use a plain `<div className="flex justify-end gap-2">`
 * as footer rather than the heavier `DialogFooter` (`border-t bg-muted/50`).
 */
function DialogRoot({ ...props }: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />;
}

export { DialogRoot };
