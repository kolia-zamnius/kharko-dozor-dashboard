/**
 * Stable palette shared between the activity histogram, page distribution and
 * any legend that needs to reference pathnames by color.
 *
 * Invariant: the same pathname MUST map to the same color across all charts
 * within a single render. We achieve this with a deterministic string hash
 * rather than first-seen ordering (which depends on data order and isn't
 * stable across endpoints).
 */

export const PAGE_COLOR_CLASSES = [
  "bg-violet-500",
  "bg-blue-500",
  "bg-emerald-500",
  "bg-amber-500",
  "bg-rose-500",
  "bg-cyan-500",
  "bg-pink-500",
  "bg-teal-500",
  "bg-orange-500",
  "bg-indigo-500",
] as const;

/** FNV-1a string hash. Small, deterministic, no deps. */
function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function indexForPathname(pathname: string): number {
  return hashString(pathname) % PAGE_COLOR_CLASSES.length;
}

export function colorClassForPathname(pathname: string): string {
  // `PAGE_COLOR_CLASSES[0]` is a literal element of a non-empty `as const`
  // tuple, so TS narrows it to `string` (not `string | undefined`) and the
  // `??` fallback is safe under `noUncheckedIndexedAccess`. The ternary
  // modulo guarantees `indexForPathname` returns `[0, length)`; the
  // fallback only exists to satisfy the type system.
  return PAGE_COLOR_CLASSES[indexForPathname(pathname)] ?? PAGE_COLOR_CLASSES[0];
}
