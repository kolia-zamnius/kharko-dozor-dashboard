"use client";

import { MoonIcon, SunIcon } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";

import { Button } from "@/components/ui/primitives/button";

/**
 * Icon swap via Tailwind `dark:block`/`dark:hidden` (not a `mounted` flag) —
 * server HTML matches first client render exactly, no hydration mismatch.
 *
 * `aria-label` is stateless because `resolvedTheme` is undefined on SSR under
 * `defaultTheme="system"`. State is conveyed via `aria-pressed` (wrapped in
 * `suppressHydrationWarning` for the same SSR-undefined reason).
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
