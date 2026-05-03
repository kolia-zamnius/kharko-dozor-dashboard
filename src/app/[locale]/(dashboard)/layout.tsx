import type { ReactNode } from "react";
import { DemoBanner } from "./components/demo-banner";
import { Navbar } from "./components/navbar";

// `force-dynamic` — auth-gated, session-dependent, suspense-driven; none of these prerender meaningfully.

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
