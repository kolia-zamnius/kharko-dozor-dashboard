import Image from "next/image";
import { getLocale, getTranslations } from "next-intl/server";

import { Button } from "@/components/ui/primitives/button";
import type { Locale } from "@/i18n/config";
import { Link } from "@/i18n/navigation";

import { EXTERNAL_LINKS } from "../lib/external-links";
import { LocaleSelectCompact } from "./locale-select-compact";
import { ThemeToggle } from "./theme-toggle";

/**
 * No per-request data so the marketing tree stays statically generatable —
 * matters for Lighthouse mobile LCP. Single CTA "Get started" works for
 * everyone (proxy redirects authed users away from `/sign-up`). Locale
 * picker is the only client island.
 */
export async function MarketingHeader() {
  const locale = (await getLocale()) as Locale;
  const t = await getTranslations("marketing.header");

  return (
    <header className="border-border bg-background/80 sticky top-0 z-30 flex h-14 items-center justify-between border-b px-4 backdrop-blur sm:px-6">
      <Link href="/" className="flex items-center gap-2">
        <Image src="/assets/logo.svg" alt="Dozor" width={28} height={28} priority />
        <span className="hidden text-sm font-semibold tracking-tight sm:inline">Dozor</span>
      </Link>

      <div className="flex items-center gap-2">
        <ThemeToggle />
        <LocaleSelectCompact currentLocale={locale} />
        {/* Raw `<a href>` — docs zone is outside `[locale]/`, typed Link would prefix `/uk/documentation/...` and 404. */}
        <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">

          <a href={EXTERNAL_LINKS.docs}>{t("documentation")}</a>
        </Button>
        <Button asChild size="sm">
          <Link href="/sign-up">{t("signUp")}</Link>
        </Button>
      </div>
    </header>
  );
}
