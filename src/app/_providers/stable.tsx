"use client";

import { Toaster } from "@/components/ui/feedback/sonner";
import { getQueryClient } from "@/lib/query-client";
import { QueryClientProvider } from "@tanstack/react-query";
import { SessionProvider } from "next-auth/react";
import { ThemeProvider } from "next-themes";

/**
 * App-wide client providers that are **stable across locale
 * navigations**. Mounted from the non-localised root layout
 * (`src/app/layout.tsx`) so that switching `/en` ↔ `/uk` doesn't
 * tear any of these down:
 *
 *   - `QueryClientProvider` — TanStack Query cache root.
 *   - `SessionProvider`     — Auth.js session context.
 *   - `ThemeProvider`       — `next-themes` class-based dark mode.
 *   - `<Toaster />`         — sonner toast outlet. Mutations surface
 *                             success/error messages through the global
 *                             `MutationCache` handler in `query-client.ts`.
 *
 * @remarks
 * Keeping `ThemeProvider` above the `[locale]` segment is load-bearing
 * under React 19: `next-themes@0.4.x` renders its pre-hydration theme-
 * init script through `React.createElement("script", …)`, and React 19
 * logs *"Encountered a script tag while rendering React component"*
 * every time that element is torn down and recreated on the client.
 * Mounting the provider once — outside the segment that re-renders on
 * locale change — means the warning never fires.
 *
 * i18n is deliberately **not** set up here. `NextIntlClientProvider`
 * and the imperative-translator / Zod-error-map bridges that depend on
 * it live in the sibling {@link ./i18n-bridge.tsx}, which is mounted
 * inside the `[locale]` segment and therefore sees the fresh locale on
 * every navigation. If i18n were wired from this file, the context
 * value would freeze to whatever locale was active at initial render
 * and never update on soft navigation — root layouts don't re-render
 * on client-side nav between sibling segments.
 *
 * **When to collapse this split back into a single `providers.tsx`.**
 * The only reason this file and {@link ./i18n-bridge.tsx} are
 * separate is the React 19 + `next-themes@0.4.x` script-warning
 * interaction described above. If any of the following happens, the
 * split is safe to undo:
 *
 *   1. `next-themes` ships a major version that moves the theme-init
 *      script out of the React tree (GitHub head discussion lives on
 *      `pacocoursey/next-themes`; `1.0.0-beta.0` at time of writing
 *      still uses the same pattern).
 *   2. We adopt a custom theme implementation that writes to
 *      `document.documentElement.classList` from `<head>` directly,
 *      bypassing React reconciliation for the script.
 *   3. React 19 relaxes the `<script>`-in-tree warning.
 *
 * Collapse path: move `I18nBridge`'s three effects back into this
 * component, drop the sibling file, and delete the `_providers/`
 * folder in favour of a single `src/app/providers.tsx`. Route group
 * imports update atomically.
 *
 * HeroUI used to live here (`RouterProvider`, `Toast.Provider`) but was
 * removed — the dashboard is fully on Radix + Tailwind + sonner now.
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
