"use client";

import * as React from "react";
import { Dialog as DialogPrimitive } from "radix-ui";

function DialogPortal({ ...props }: React.ComponentProps<typeof DialogPrimitive.Portal>) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />;
}

export { DialogPortal };
