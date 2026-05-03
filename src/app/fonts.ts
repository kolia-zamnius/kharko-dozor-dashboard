import { Inter, JetBrains_Mono } from "next/font/google";

/**
 * Inter ships Cyrillic because UI is translated into Ukrainian + tracked-user
 * traits surface user-generated Cyrillic. JetBrains Mono is Latin-only — mono
 * is reserved for code/commands/IDs/IBAN, Cyrillic subset would be dead weight.
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
