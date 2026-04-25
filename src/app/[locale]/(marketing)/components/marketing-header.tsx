import Image from "next/image";
import { getLocale, getTranslations } from "next-intl/server";

import { Button } from "@/components/ui/primitives/button";
import type { Locale } from "@/i18n/config";
import { Link } from "@/i18n/navigation";

import { LocaleSelectCompact } from "./locale-select-compact";
import { ThemeToggle } from "./theme-toggle";

/**
 * Marketing-zone sticky header — a minimal shell that replaces the
 * dashboard navbar for the `/` landing surface.
 *
 * @remarks
 * Pure Server Component with **no per-request data**. The CTA pair
 * ("Sign in" + "Get started") is the same for every visitor regardless
 * of session state — the marketing surface is overwhelmingly an
 * anonymous-prospect funnel, and the proxy already redirects authed
 * users away from `/sign-in` and `/sign-up` to the dashboard
 * (`src/proxy.ts:74-75`). A returning logged-in visitor who clicks
 * "Sign in" gets a single-hop bounce to `/users`; the gain in
 * exchange is making the entire marketing tree statically
 * generatable, which slashes TTFB and lets Lighthouse mobile LCP
 * clear the 90 threshold.
 *
 * The locale picker is a small Client Component — that keeps the rest
 * of the header in the Server Component graph.
 */
export async function MarketingHeader() {
  const locale = (await getLocale()) as Locale;
  const t = await getTranslations("marketing.header");

  return (
    <header className="border-border bg-background/80 sticky top-0 z-30 flex h-14 items-center justify-between border-b px-4 backdrop-blur sm:px-6">
      <Link href="/" className="flex items-center gap-2">
        <Image src="/assets/logo.svg" alt="Kharko Dozor" width={28} height={28} priority />
        <span className="hidden text-sm font-semibold tracking-tight sm:inline">Kharko Dozor</span>
      </Link>

      <div className="flex items-center gap-2">
        <ThemeToggle />
        <LocaleSelectCompact currentLocale={locale} />
        <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
          <Link href="/sign-in">{t("signIn")}</Link>
        </Button>
        <Button asChild size="sm">
          <Link href="/sign-up">{t("signUp")}</Link>
        </Button>
      </div>
    </header>
  );
}
