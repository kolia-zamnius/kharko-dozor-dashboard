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
 * Pure Server Component — interactive islands hydrate as leaf clients.
 * Effectively static per locale, no `force-dynamic`. Header consumes session
 * server-side so this page doesn't read it.
 */
export async function generateMetadata(): Promise<Metadata> {
  const locale = (await getLocale()) as Locale;
  const t = await getTranslations({ locale, namespace: "marketing.meta" });
  const baseUrl = getAppUrl();
  // Trailing slash on default locale matches the served URL after prefix
  // stripping. Without it Lighthouse's canonical audit fails ("points to
  // another hreflang location") because canonical = the `en` hreflang.
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
      siteName: "Dozor",
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
    name: "Dozor",
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
      {/* `application/ld+json` is non-JS — React 19's `isScriptDataBlock` treats it as data
          and skips the script-tag warning. `dangerouslySetInnerHTML` avoids text-node escaping. */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <HeroSection />
      <FeaturesSection />
      <InstallationSection />
      <ThankAuthorSection />
    </>
  );
}
