import { Spinner } from "@/components/ui/feedback/spinner";

/**
 * Next.js `loading.tsx` — fallback shown while the replay shell's
 * Suspense queries resolve on initial navigation. A single page-level
 * spinner keeps the loading experience consistent with the rest of
 * the dashboard (no per-section skeletons).
 */
export default function ReplayLoading() {
  return (
    <div className="flex justify-center py-24">
      <Spinner />
    </div>
  );
}
