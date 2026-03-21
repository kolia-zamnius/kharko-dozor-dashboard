import { Inter, JetBrains_Mono } from "next/font/google";

/**
 * App typography — self-hosted Google fonts loaded via `next/font`.
 *
 * @remarks
 * Both families ship Latin + Cyrillic subsets because the app surfaces
 * Ukrainian-formatted dates (`uk-UA` locale) and Cyrillic user-generated
 * content (tracked-user traits, org names). `display: "swap"` is the
 * correct choice for a session-recording dashboard — FOIT would delay
 * the replay UI on every cold load.
 *
 * CSS variables (`--font-sans`, `--font-mono`) are exposed through the
 * HTML `className` in the root layout and consumed by Tailwind v4
 * `@theme inline` bindings in `globals.css`.
 */
export const inter = Inter({
  subsets: ["latin", "cyrillic"],
  variable: "--font-sans",
  display: "swap",
});

export const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin", "cyrillic"],
  variable: "--font-mono",
  display: "swap",
});
