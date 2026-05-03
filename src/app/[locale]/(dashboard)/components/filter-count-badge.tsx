import { Badge } from "@/components/ui/primitives/badge";

/** `null` when count ≤ 0 so callers pass it unconditionally. */
export function FilterCountBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <Badge variant="secondary" className="ml-0.5 size-5 rounded-full p-0 text-[10px]">
      {count}
    </Badge>
  );
}
