import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Tailwind class-name combiner — `clsx` + `tailwind-merge`.
 *
 * @remarks
 * Two responsibilities, both critical for a `cva`-based component system:
 *
 *   1. **`clsx`** flattens nested arrays / objects / falsy values into a
 *      single space-separated string. Lets call sites write
 *      `cn("base", { active }, error && "text-red-500")` without manual
 *      filtering.
 *
 *   2. **`twMerge`** resolves Tailwind conflicts by keeping the LAST
 *      utility in any given group. Without it, `cn("p-2", "p-4")`
 *      produces `"p-2 p-4"` and Tailwind's cascade picks whichever rule
 *      was emitted first — usually the wrong one. With it, you get
 *      `"p-4"` as intended. This is what makes `className` overrides on
 *      primitive components actually work.
 *
 * Historically shadcn names this file `utils.ts` — we deliberately
 * renamed to `cn.ts` because the file holds exactly one function and
 * the whole reason to keep the shadcn name (copy-paste compatibility
 * with generator output) no longer applies: `src/components/ui/` will
 * be replaced with fully custom Kharko primitives once the visual
 * identity settles.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
