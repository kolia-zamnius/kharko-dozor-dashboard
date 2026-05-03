import type { ReactNode } from "react";

import { DocsLayout } from "fumadocs-ui/layouts/docs";
import { RootProvider } from "fumadocs-ui/provider/next";

import { source } from "@/lib/source";

/**
 * `(docs)` route group — inherits the non-localised root, bypasses the locale
 * pipeline (English-only by design). `theme: { enabled: false }` keeps the
 * existing `next-themes` mount in stable providers as the single ThemeProvider
 * — doubling would re-trip the React 19 script-tag warning.
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
