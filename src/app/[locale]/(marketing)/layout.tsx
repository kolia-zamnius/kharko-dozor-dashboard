import type { ReactNode } from "react";

import { getTranslations } from "next-intl/server";

import { MarketingFooter } from "./components/marketing-footer";
import { MarketingHeader } from "./components/marketing-header";

/**
 * Marketing route group layout — minimal shell hosting the public-facing
 * landing surface. Replaces the dashboard navbar + drawer with a lean
 * header/footer pair so the viewport is dominated by content rather
 * than chrome.
 *
 * @remarks
 * Intentionally distinct from `(dashboard)/layout.tsx` — marketing is
 * always anonymous-accessible, never force-dynamic, and has no
 * per-page auth guard. The header reads session server-side for its
 * CTA (Sign in vs. Go to dashboard), so a logged-in author sees the
 * same page their visitors see.
 *
 * A "Skip to content" link is rendered as the first focusable element
 * — visually hidden until it receives focus, at which point it snaps
 * into view below the header. Keyboard and screen-reader users can
 * bypass the full navigation in a single Tab/Enter.
 */
export default async function MarketingLayout({ children }: { children: ReactNode }) {
  const t = await getTranslations("common.a11y");

  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main-content"
        className="bg-background text-foreground ring-ring sr-only z-50 rounded-md px-4 py-2 text-sm font-medium focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:ring-2 focus:outline-none"
      >
        {t("skipToContent")}
      </a>
      <MarketingHeader />
      <main id="main-content" className="flex-1">
        {children}
      </main>
      <MarketingFooter />
    </div>
  );
}
