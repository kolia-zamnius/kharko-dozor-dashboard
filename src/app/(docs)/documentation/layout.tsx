import type { ReactNode } from "react";

import { DocsLayout } from "fumadocs-ui/layouts/docs";
import { RootProvider } from "fumadocs-ui/provider/next";

import { source } from "@/lib/source";

/**
 * Docs zone layout — Fumadocs `docs` preset.
 *
 * @remarks
 * Lives in the `(docs)` route group so it inherits the non-localised
 * root from `src/app/layout.tsx` and skips the locale pipeline. Docs
 * are English-only by design.
 *
 * Top-level sections (Get Started / Dashboard / SDK / Resources) render
 * as labelled separators inside the sidebar — defined in
 * `_content/meta.json` via the `"---Title---"` syntax.
 *
 * `RootProvider` is scoped here (not at the app root) and runs with
 * `theme: { enabled: false }` so the existing `next-themes` mount in
 * stable providers stays the single ThemeProvider — avoids the React 19
 * script-tag warning a doubled provider would re-trip.
 */
export default function DocsZoneLayout({ children }: { children: ReactNode }) {
  return (
    <RootProvider theme={{ enabled: false }}>
      <DocsLayout
        tree={source.pageTree}
        nav={{ title: "Dozor" }}
        githubUrl="https://github.com/kolia-zamnius/kharko-dozor-dashboard"
      >
        {children}
      </DocsLayout>
    </RootProvider>
  );
}
