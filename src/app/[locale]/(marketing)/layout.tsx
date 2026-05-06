import type { ReactNode } from "react";

import { getTranslations } from "next-intl/server";

import { DotGridBackground } from "./components/dot-grid-background";
import { MarketingFooter } from "./components/marketing-footer";
import { MarketingHeader } from "./components/marketing-header";

/**
 * Anonymous-accessible — no per-page auth guard. Header CTA reads session
 * server-side. "Skip to content" is the first focusable element (visually
 * hidden until focused) — keyboard/screen-reader bypass in one Tab/Enter.
 */
export default async function MarketingLayout({ children }: { children: ReactNode }) {
  const t = await getTranslations("common.a11y");

  return (
    <div className="flex min-h-dvh flex-col">
      <DotGridBackground />
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
