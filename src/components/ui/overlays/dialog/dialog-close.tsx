"use client";

import * as React from "react";
import { Dialog as DialogPrimitive } from "radix-ui";

function DialogClose({ ...props }: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />;
}

export { DialogClose };
