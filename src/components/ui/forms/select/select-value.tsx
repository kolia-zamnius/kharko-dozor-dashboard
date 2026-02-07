"use client";

import * as React from "react";
import { Select as SelectPrimitive } from "radix-ui";

function SelectValue({ ...props }: React.ComponentProps<typeof SelectPrimitive.Value>) {
  return <SelectPrimitive.Value data-slot="select-value" {...props} />;
}

export { SelectValue };
