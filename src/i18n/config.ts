/**
 * Locale inventory and UI labels — single source of truth for every
 * other module in `src/i18n/`.
 *
 * @remarks
 * `LOCALES` is declared `as const` so the `Locale` union is the exact
 * string literal set (`"en"` today, `"en" | "uk" | …` when we roll out
 * translations). Adding a locale is a one-line change here plus the
 * matching `messages/<locale>/` folder — every downstream consumer
 * (`routing.ts`, `request.ts`, `<LocaleSelect>`) reads from this file,
 * so there's no parallel list to keep in sync.
 *
 * `LOCALE_LABELS` is `Record<Locale, string>` on purpose — adding a
 * locale without its human-readable label becomes a compile error
 * rather than a blank dropdown entry.
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
