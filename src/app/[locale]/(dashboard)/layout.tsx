import type { ReactNode } from "react";
import { DemoBanner } from "./components/demo-banner";
import { Navbar } from "./components/navbar";

/**
 * Dashboard layout — wraps every authenticated route under `(dashboard)`.
 *
 * @remarks
 * `dynamic = "force-dynamic"` makes every dashboard page opt out of
 * static prerendering. These routes are auth-gated (the `proxy.ts`
 * middleware redirects unauthenticated requests), session-dependent,
 * and rely on `useSuspenseQuery` for client-side data — none of which
 * can be meaningfully rendered at build time without hitting the API.
 * Marking the layout dynamic is the semantic truth of what these
 * routes ARE, not a workaround.
 *
 * The skip-to-content anchor is the a11y baseline for keyboard users
 * — first focusable element in the tab order, visually hidden until
 * focused, jumps straight past the navbar to the main content. The
 * `<main id="main-content">` target is always present here (same
 * layout every page) so the link is never broken.
 */
export const dynamic = "force-dynamic";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <a
        href="#main-content"
        className="bg-background text-foreground ring-ring sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:ring-2 focus:outline-none"
      >
        Skip to main content
      </a>
      <DemoBanner />
      <Navbar />
      <main id="main-content" className="container mx-auto p-3">
        {children}
      </main>
    </>
  );
}
