/**
 * External URLs referenced from the marketing landing. Kept in one file
 * so links stay consistent across sections (hero CTA, installation,
 * footer).
 *
 * @remarks
 * `docs` points at the in-app `/documentation` zone (English-only,
 * outside the `[locale]/` pipeline). It is **internal**: every render
 * site treats it as a same-origin link (no `target="_blank"`, no
 * `rel="noreferrer"`).
 *
 * Donation details are kept here rather than in messages JSON because
 * they're immutable account identifiers, not translatable copy — the
 * bank-transfer receiver, IBAN, BIC, and Monobank short-link don't
 * change with the active locale. Only the surrounding prose in
 * `marketing.json` is localised.
 */
export const EXTERNAL_LINKS = {
  /** Open-source SDK monorepo (tracker + React bindings). */
  sdkRepo: "https://github.com/kolia-zamnius/kharko-dozor-packages",
  /** This dashboard's own repository. */
  dashboardRepo: "https://github.com/kolia-zamnius/kharko-dozor-dashboard",
  /** Core rrweb SDK package on npm. */
  npmSdk: "https://www.npmjs.com/package/@kharko/dozor",
  /** React bindings for the SDK on npm. */
  npmSdkReact: "https://www.npmjs.com/package/@kharko/dozor-react",
  /**
   * Documentation entry point — in-app Fumadocs site at
   * `/documentation`. Internal link, served by `src/app/(docs)/`.
   */
  docs: "/documentation/introduction",
  contact: {
    email: "kolzam.person@gmail.com",
    linkedin: "https://www.linkedin.com/in/kolia-zamnyus-a892a0332/",
    github: "https://github.com/kolia-zamnius",
  },
  donations: {
    /** Monobank `send` short-link — one-tap UAH donation. */
    monobank: "https://send.monobank.ua/44D5X5cUJS",
    eur: {
      iban: "GB84CLJU00997180803000",
      bic: "CLJUGB21",
      receiver: "ZAMNYUS MYKOLA",
    },
  },
} as const;
