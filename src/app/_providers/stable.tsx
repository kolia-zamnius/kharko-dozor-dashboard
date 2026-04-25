"use client";

import { Toaster } from "@/components/ui/feedback/sonner";
import { ThemeProvider } from "next-themes";

/**
 * App-wide client providers that are **stable across locale
 * navigations**. Mounted from the non-localised root layout
 * (`src/app/layout.tsx`) so that switching `/en` ↔ `/uk` doesn't
 * tear any of these down:
 *
 *   - `ThemeProvider` — `next-themes` class-based dark mode.
 *   - `<Toaster />`   — sonner toast outlet. Mutations surface
 *                       success/error messages through the global
 *                       `MutationCache` handler in `query-client.ts`,
 *                       and the auth pages emit OTP / sign-in toasts
 *                       via `toast()` directly.
 *
 * Both surfaces (every route group) need these — the marketing
 * landing has the theme toggle, every flow can surface a toast — so
 * they sit at the top of the tree regardless of route.
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
 * Heavy client providers — `QueryClientProvider`, `SessionProvider` —
 * used to live here too. They were lifted into
 * {@link ./session-query.tsx} and now mount only inside the
 * `(dashboard)` route group, where every page actually consumes them.
 * The marketing landing is fully static and the auth pages reach
 * `signIn` / `toast()` without provider context, so paying ~40 KB of
 * client JS for them globally was wasted weight on Lighthouse mobile.
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
 * HeroUI used to live here (`RouterProvider`, `Toast.Provider`) but was
 * removed — the dashboard is fully on Radix + Tailwind + sonner now.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      {children}
      <Toaster position="top-center" richColors />
    </ThemeProvider>
  );
}
