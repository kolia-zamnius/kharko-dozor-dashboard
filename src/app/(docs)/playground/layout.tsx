"use client";

import { DozorProvider } from "@kharko/dozor-react";
import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Provider mount is at layout (not page) level so SDK state survives `<Link>`
 * navigation between sub-pages — that navigation is exactly what the
 * playground demonstrates (slice-marker creation on SPA route change).
 *
 * No `options` so it doesn't auto-init — `useDozor().init({...})` runs on
 * form submit. Public surface, English-only (same rule as docs zone).
 */
export default function PlaygroundLayout({ children }: { children: ReactNode }) {
  return (
    <DozorProvider>
      <div className="min-h-screen">
        <header className="border-border/50 border-b">
          <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
            <Link href="/playground" className="font-semibold tracking-tight">
              Dozor Playground
            </Link>
            <Link href="/documentation" className="text-muted-foreground hover:text-foreground text-sm">
              Docs →
            </Link>
          </div>
        </header>
        <main className="mx-auto max-w-3xl px-6 py-10">{children}</main>
      </div>
    </DozorProvider>
  );
}
