import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * `clsx` joins falsy-aware; `twMerge` resolves Tailwind conflicts so `cn("p-2", "p-4")`
 * renders `"p-4"` (last-wins per utility group). What makes `className` overrides on
 * `cva` primitives actually work.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
