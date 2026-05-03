import type { MetadataRoute } from "next";

import { DEFAULT_LOCALE, LOCALES } from "@/i18n/config";
import { source } from "@/lib/source";
import { getAppUrl } from "@/server/app-url";

/**
 * Marketing landing per locale with hreflang alternates (default locale has
 * no prefix to match `localePrefix: "as-needed"`); docs are English-only and
 * enumerated from the Fumadocs source — new MDX shows up next deploy.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = getAppUrl();
  const now = new Date();

  const urlFor = (locale: string) => (locale === DEFAULT_LOCALE ? `${baseUrl}/` : `${baseUrl}/${locale}`);
  const languages = Object.fromEntries(LOCALES.map((locale) => [locale, urlFor(locale)]));

  const marketing: MetadataRoute.Sitemap = LOCALES.map((locale) => ({
    url: urlFor(locale),
    lastModified: now,
    changeFrequency: "monthly",
    priority: locale === DEFAULT_LOCALE ? 1.0 : 0.9,
    alternates: { languages },
  }));

  const docs: MetadataRoute.Sitemap = [
    {
      url: `${baseUrl}/documentation`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    ...source.getPages().map((page) => ({
      url: `${baseUrl}${page.url}`,
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
  ];

  return [...marketing, ...docs];
}
