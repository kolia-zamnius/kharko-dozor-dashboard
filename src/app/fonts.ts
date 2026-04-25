import { Inter, JetBrains_Mono } from "next/font/google";

/**
 * App typography — self-hosted Google fonts loaded via `next/font`.
 *
 * @remarks
 * Inter ships Latin + Cyrillic because UI copy is translated into
 * Ukrainian and the dashboard surfaces Cyrillic user-generated content
 * (tracked-user traits, org names). JetBrains Mono ships Latin only —
 * mono is reserved for Latin-only payloads (npm commands, IBAN/BIC,
 * code snippets, IDs); shipping its Cyrillic subset would be dead
 * weight on every page. `display: "swap"` avoids FOIT — the replay UI
 * and marketing hero render immediately on the fallback face.
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
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});
