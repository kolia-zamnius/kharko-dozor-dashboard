import { Label } from "@/components/ui/forms/label";
import { cn } from "@/lib/cn";
import type { ReactNode } from "react";

type FieldProps = {
  label: string;
  htmlFor: string;
  children: ReactNode;
  className?: string;
};

/**
 * Label + control pair used by every form on the playground.
 *
 * @remarks
 * `htmlFor` is required so the `<label>` is bound to the control's id
 * — keyboard / screen-reader users can click the label to focus the
 * input. `className` is forwarded so callers can opt rows into grid
 * spans (e.g. `sm:col-span-2`) without wrapping the field in another
 * div.
 */
export function Field({ label, htmlFor, children, className }: FieldProps) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  );
}
