/**
 * External URLs referenced from the marketing landing. Kept in one file
 * so links stay consistent across sections (hero CTA, installation,
 * footer) and flipping a destination — notably `docs`, which currently
 * points at the SDK README on GitHub — is a single-line change.
 *
 * @remarks
 * `docs` is the intended flip-switch: once the public docs site ships
 * under `/docs`, change the value to `"/docs"` (or `/docs/getting-started`)
 * and every reference in the landing updates atomically. Do **not**
 * inline the GitHub URL at call sites.
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
   * Documentation entry point. Currently points at the SDK README on
   * GitHub — flip to an in-app `/docs/getting-started` path when the
   * public docs site ships.
   */
  docs: "https://github.com/kolia-zamnius/kharko-dozor-packages#readme",
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
