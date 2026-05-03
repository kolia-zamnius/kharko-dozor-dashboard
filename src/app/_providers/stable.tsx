"use client";

import { Toaster } from "@/components/ui/feedback/sonner";
import { getQueryClient } from "@/lib/query-client";
import { QueryClientProvider } from "@tanstack/react-query";
import { SessionProvider } from "next-auth/react";
import { ThemeProvider } from "next-themes";

/**
 * `next-themes@0.4.x` renders its FOUC-prevention init via `React.createElement("script", ...)`,
 * and React 19 unconditionally warns about any `<script>` in the tree — false
 * positive, the SSR'd script already ran before hydration. Replacing
 * `next-themes` would break Fumadocs (it imports `useTheme` internally), so we
 * filter the exact message string. HMR-safe via `__patched` flag.
 *
 * Remove when next-themes 1.x ships, React 19 relaxes the warning, or we
 * provide a Fumadocs-compatible shim.
 */
type PatchedConsole = Console & { __nextThemesScriptWarningPatched?: boolean };
if (typeof window !== "undefined") {
  const patched = console as PatchedConsole;
  if (!patched.__nextThemesScriptWarningPatched) {
    const original = console.error;
    console.error = (...args: unknown[]) => {
      const first = args[0];
      if (
        typeof first === "string" &&
        first.includes("Encountered a script tag while rendering React component")
      ) {
        return;
      }
      original(...args);
    };
    patched.__nextThemesScriptWarningPatched = true;
  }
}

/**
 * Locale-stable providers — mounted above `[locale]` so locale swaps don't
 * tear them down. `ThemeProvider` placement is load-bearing: tearing it down
 * trips the React 19 script-tag warning every locale change.
 *
 * i18n is deliberately split into `./i18n-bridge.tsx` (mounted inside
 * `[locale]`) — root layouts don't re-render on client-side nav between
 * sibling segments, so a `NextIntlClientProvider` here would freeze to the
 * initial-render locale.
 *
 * Collapse this split back into one `providers.tsx` when next-themes 1.x
 * ships (head discussion on `pacocoursey/next-themes`), we adopt a custom
 * theme that bypasses React for the FOUC script, OR React 19 relaxes the
 * warning. Move `I18nBridge`'s effects back inline + delete `_providers/`.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  const queryClient = getQueryClient();

  return (
    <QueryClientProvider client={queryClient}>
      <SessionProvider>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          {children}
          <Toaster position="top-center" richColors />
        </ThemeProvider>
      </SessionProvider>
    </QueryClientProvider>
  );
}
