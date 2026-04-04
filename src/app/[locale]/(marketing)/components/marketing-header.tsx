import Image from "next/image";
import { getLocale, getTranslations } from "next-intl/server";

import { Button } from "@/components/ui/primitives/button";
import type { Locale } from "@/i18n/config";
import { Link } from "@/i18n/navigation";
import { auth } from "@/server/auth";

import { LocaleSelectCompact } from "./locale-select-compact";
import { ThemeToggle } from "./theme-toggle";

/**
 * Marketing-zone sticky header — a minimal shell that replaces the
 * dashboard navbar for the `/` landing surface.
 *
 * @remarks
 * Renders on the server so the Sign-in / Dashboard CTA resolves
 * authoritatively on first paint without a hydration flash. Uses
 * the typed `Link` from `@/i18n/navigation` for both the logo (→ `/`)
 * and the CTA so locale prefixes stay consistent.
 *
 * The locale picker is a small Client Component — that keeps the
 * rest of the header in the Server Component graph, so the session
 * read doesn't leak into the client bundle.
 */
export async function MarketingHeader() {
  const session = await auth();
  const isAuthenticated = !!session?.user;
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
        {isAuthenticated ? (
          <Button asChild size="sm">
            <Link href="/users">{t("dashboard")}</Link>
          </Button>
        ) : (
          <>
            <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
              <Link href="/sign-in">{t("signIn")}</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/sign-up">{t("signUp")}</Link>
            </Button>
          </>
        )}
      </div>
    </header>
  );
}
