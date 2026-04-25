"use client";

import { MoonIcon, SunIcon } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";

import { Button } from "@/components/ui/primitives/button";

/**
 * Marketing-header theme toggle — cycles between explicit light and
 * dark on click. First-visit default is the OS `prefers-color-scheme`
 * (configured via `<ThemeProvider defaultTheme="system" enableSystem>`
 * in `src/app/_providers/stable.tsx`); clicking the toggle commits an explicit
 * choice to `localStorage`, after which `next-themes` stops following
 * the system setting on subsequent visits.
 *
 * @remarks
 * Icon swap is driven by a pure CSS `dark:` variant rather than a
 * `mounted` state flag. Both `<SunIcon>` and `<MoonIcon>` render on
 * every pass, and Tailwind's `dark:block` / `dark:hidden` flips which
 * one is visible based on the `class="dark"` attribute that
 * `next-themes` sets on `<html>` via its pre-hydration script.
 * Server-rendered HTML therefore matches the first client render
 * exactly — no hydration mismatch, no `mounted` guard, no flicker.
 *
 * `aria-label` is deliberately stateless ("Toggle theme") so it's
 * accurate across SSR + every re-render without leaning on
 * `resolvedTheme` (which is `undefined` on the server under
 * `defaultTheme="system"` because it can't know the visitor's OS
 * preference).
 *
 * `aria-pressed` reflects the **current** dark state — assistive tech
 * announces the button as "pressed" when dark is active — which
 * compensates for the stateless label by conveying state through ARIA
 * semantics instead. The attribute is wrapped in
 * `suppressHydrationWarning` because `resolvedTheme` is `undefined` on
 * the server; React would otherwise log an attribute-mismatch warning
 * on every page load.
 */
export function ThemeToggle() {
  const t = useTranslations("common.theme");
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label={t("toggle")}
      aria-pressed={isDark}
      onClick={() => setTheme(isDark ? "light" : "dark")}
      suppressHydrationWarning
    >
      <SunIcon className="hidden dark:block" />
      <MoonIcon className="block dark:hidden" />
    </Button>
  );
}
