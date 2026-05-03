// Hash-based (not first-seen) so the same pathname maps to the same colour
// across charts within a single render — first-seen ordering depends on data
// order and isn't stable across endpoints.

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

/** FNV-1a — small, deterministic, no deps. */
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
  // `?? PAGE_COLOR_CLASSES[0]` only exists for `noUncheckedIndexedAccess` — the modulo guarantees the lookup is in range.
  return PAGE_COLOR_CLASSES[indexForPathname(pathname)] ?? PAGE_COLOR_CLASSES[0];
}
