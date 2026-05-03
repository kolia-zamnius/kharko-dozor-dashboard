/**
 * Locale inventory — the `as const` makes `Locale` a literal union. Adding one is
 * this file + a new `messages/<locale>/` folder; `LOCALE_LABELS` won't compile
 * without a label for the new key.
 */
export const LOCALES = ["en", "uk", "de", "es", "pt", "it"] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";

export const LOCALE_LABELS: Record<Locale, string> = {
  en: "English",
  uk: "Українська",
  de: "Deutsch",
  es: "Español",
  pt: "Português",
  it: "Italiano",
};
