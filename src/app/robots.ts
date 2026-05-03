import type { MetadataRoute } from "next";

import { getAppUrl } from "@/server/app-url";

/**
 * Marketing is index-all by default; dashboard paths are blocked even though
 * proxy.ts bounces anon crawlers — saves crawl budget.
 */
export default function robots(): MetadataRoute.Robots {
  const baseUrl = getAppUrl();
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/auth/", "/settings/", "/users/", "/replays/", "/invite/"],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
