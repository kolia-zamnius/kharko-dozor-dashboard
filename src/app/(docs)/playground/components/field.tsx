import { Label } from "@/components/ui/forms/label";
import { cn } from "@/lib/cn";
import type { ReactNode } from "react";

type FieldProps = {
  label: string;
  htmlFor: string;
  children: ReactNode;
  className?: string;
};

export function Field({ label, htmlFor, children, className }: FieldProps) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  );
}
