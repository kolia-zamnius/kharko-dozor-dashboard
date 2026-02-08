import { cn } from "@/lib/cn";

/**
 * Placeholder block for content that's still loading.
 *
 * @remarks
 * Used sparingly — per project convention (`feedback_loading.md`), a
 * single centred Spinner is preferred over Skeleton placeholders on
 * most pages. Skeleton is reserved for specific shells where layout
 * shift on load would be jarring (e.g. card grids).
 */
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="skeleton" className={cn("bg-muted animate-pulse rounded-md", className)} {...props} />;
}

export { Skeleton };
