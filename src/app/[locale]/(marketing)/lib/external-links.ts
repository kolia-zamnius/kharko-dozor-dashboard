// Donations stay here (not messages JSON) — IBAN/BIC/receiver are wire strings, not translatable copy.

export const EXTERNAL_LINKS = {
  sdkRepo: "https://github.com/kolia-zamnius/kharko-dozor-packages",
  dashboardRepo: "https://github.com/kolia-zamnius/kharko-dozor-dashboard",
  npmSdk: "https://www.npmjs.com/package/@kharko/dozor",
  npmSdkReact: "https://www.npmjs.com/package/@kharko/dozor-react",
  /** In-app Fumadocs at `/documentation` — internal, no `target="_blank"`. */
  docs: "/documentation/introduction",
  contact: {
    email: "kolzam.person@gmail.com",
    linkedin: "https://www.linkedin.com/in/kolia-zamnyus-a892a0332/",
    github: "https://github.com/kolia-zamnius",
  },
  donations: {
    monobank: "https://send.monobank.ua/44D5X5cUJS",
    eur: {
      iban: "GB84CLJU00997180803000",
      bic: "CLJUGB21",
      receiver: "ZAMNYUS MYKOLA",
    },
  },
} as const;
