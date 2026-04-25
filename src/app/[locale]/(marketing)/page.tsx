import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";

import { DEFAULT_LOCALE, LOCALES, type Locale } from "@/i18n/config";
import { getAppUrl } from "@/server/app-url";

import { FeaturesSection } from "./components/features-section";
import { HeroSection } from "./components/hero-section";
import { InstallationSection } from "./components/installation-section";
import { ThankAuthorSection } from "./components/thank-author-section";
import { EXTERNAL_LINKS } from "./lib/external-links";

/**
 * Marketing landing at `/` — composition root.
 *
 * @remarks
 * Pure Server Component — every section below is locale-aware server
 * content; the interactive islands (tab widget, clipboard buttons,
 * theme toggle, locale picker) hydrate as small leaf clients. No
 * `force-dynamic` — the page is effectively static per locale and
 * Next.js can cache accordingly. Auth state is consumed by the
 * header server-side, so this page doesn't need to read the session.
 *
 * Metadata is split across three concerns:
 *
 *   1. **Title / description** — from `marketing.meta.*`, localised
 *      per `getTranslations`.
 *   2. **Canonical + hreflang** — `alternates.canonical` pins the
 *      per-locale URL so search engines don't treat `/` and `/uk`
 *      as duplicates; `alternates.languages` supplies the hreflang
 *      map for language-preference routing.
 *   3. **JSON-LD `SoftwareApplication`** — inlined inside the page
 *      body as `<script type="application/ld+json">` (non-JS type,
 *      so React 19's "script inside React component" warning is
 *      bypassed by `isScriptDataBlock`).
 */
export async function generateMetadata(): Promise<Metadata> {
  const locale = (await getLocale()) as Locale;
  const t = await getTranslations({ locale, namespace: "marketing.meta" });
  const baseUrl = getAppUrl();
  // Trailing slash on the default locale matches the actual served URL
  // (`<base>/` after locale-prefix stripping). Without it the `<link
  // rel="canonical">` value diverges from the document URL the browser
  // and search engines see, and the Lighthouse `canonical` audit fails
  // with "Points to another hreflang location" because the canonical
  // also appears verbatim as the `en` hreflang alternate.
  const urlFor = (l: Locale) => (l === DEFAULT_LOCALE ? `${baseUrl}/` : `${baseUrl}/${l}`);

  return {
    title: t("title"),
    description: t("description"),
    alternates: {
      canonical: urlFor(locale),
      languages: Object.fromEntries(LOCALES.map((l) => [l, urlFor(l)])),
    },
    openGraph: {
      title: t("title"),
      description: t("description"),
      url: urlFor(locale),
      siteName: "Kharko Dozor",
      locale,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: t("title"),
      description: t("description"),
    },
  };
}

export default async function MarketingHomePage() {
  const locale = (await getLocale()) as Locale;
  const t = await getTranslations({ locale, namespace: "marketing.meta" });
  const baseUrl = getAppUrl();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Kharko Dozor",
    description: t("description"),
    applicationCategory: "DeveloperApplication",
    operatingSystem: "Web",
    url: baseUrl,
    codeRepository: EXTERNAL_LINKS.sdkRepo,
    license: "https://opensource.org/licenses/MIT",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
    author: {
      "@type": "Person",
      name: "Kolia Zamnyus",
      url: EXTERNAL_LINKS.contact.linkedin,
    },
  };

  return (
    <>
      {/* JSON-LD carries `type="application/ld+json"`, a non-JS MIME
          type — React 19's `isScriptDataBlock` treats that as a data
          block and skips the "script inside component" warning.
          `dangerouslySetInnerHTML` avoids the text-node escaping that
          would break the JSON. */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <HeroSection />
      <FeaturesSection />
      <InstallationSection />
      <ThankAuthorSection />
    </>
  );
}
