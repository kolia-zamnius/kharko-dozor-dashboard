import { Badge } from "@/components/ui/primitives/badge";

/**
 * Compact circular count chip rendered inside `<FunnelIcon>`-prefixed
 * filter triggers (Status / Project / future axes).
 *
 * @remarks
 * Single source of truth for the visual treatment — extracted from
 * three identical inline blobs in the users + replays filter bars
 * so a future radius / palette / typography change rolls through
 * one place. Returns `null` for `count <= 0` so callers can pass
 * the count unconditionally without their own guard.
 */
export function FilterCountBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <Badge variant="secondary" className="ml-0.5 size-5 rounded-full p-0 text-[10px]">
      {count}
    </Badge>
  );
}
