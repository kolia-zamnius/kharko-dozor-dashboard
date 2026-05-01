"use client";

import { DozorProvider } from "@kharko/dozor-react";
import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Playground layout — wraps every `/playground/*` route in a
 * `<DozorProvider>` without auto-init.
 *
 * @remarks
 * Lives in the `(docs)` route group, alongside `/documentation`, so it
 * inherits the non-localised root layout and skips the locale pipeline +
 * auth (handled in `src/proxy.ts` `bypassPaths`). The playground is
 * deliberately public: anyone with an API key can paste it and try the
 * SDK. English-only by the same monolingual-design rule that applies to
 * the docs zone.
 *
 * `DozorProvider` is mounted with no `options` so it doesn't auto-init —
 * the user has to paste their API key first. `useDozor().init({ ... })`
 * runs on form submit. Provider mount is at the layout (not page) level
 * so SDK state survives `<Link>` navigation between `/playground` and
 * `/playground/interactions` — that navigation is exactly what the
 * playground is meant to demonstrate (slice-marker creation on SPA
 * route change).
 */
export default function PlaygroundLayout({ children }: { children: ReactNode }) {
  return (
    <DozorProvider>
      <div className="min-h-screen">
        <header className="border-b border-border/50">
          <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
            <Link href="/playground" className="font-semibold tracking-tight">
              Dozor Playground
            </Link>
            <Link href="/documentation" className="text-sm text-muted-foreground hover:text-foreground">
              Docs →
            </Link>
          </div>
        </header>
        <main className="mx-auto max-w-3xl px-6 py-10">{children}</main>
      </div>
    </DozorProvider>
  );
}
