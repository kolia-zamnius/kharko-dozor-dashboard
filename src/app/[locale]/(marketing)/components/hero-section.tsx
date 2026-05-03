import { ArrowRightIcon, GithubLogoIcon } from "@phosphor-icons/react/dist/ssr";
import { getTranslations } from "next-intl/server";

import { Badge } from "@/components/ui/primitives/badge";
import { Button } from "@/components/ui/primitives/button";

import { EXTERNAL_LINKS } from "../lib/external-links";

/** Product-centric CTAs (not auth) — header already carries the auth button. Same pair regardless of session state. */
export async function HeroSection() {
  const t = await getTranslations("marketing.hero");

  return (
    <section className="relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_80%_50%_at_50%_-10%,var(--color-primary)/0.12,transparent)]"
      />

      <div className="mx-auto flex max-w-4xl flex-col items-center gap-6 px-4 pt-20 pb-16 text-center sm:px-6 md:pt-28 md:pb-20">
        <Badge variant="outline" className="font-normal">
          {t("eyebrow")}
        </Badge>

        <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl md:text-6xl">{t("headline")}</h1>

        <p className="text-muted-foreground max-w-2xl text-base text-pretty sm:text-lg">{t("subheadline")}</p>

        <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
          <Button asChild size="lg">
            <a href="#install">
              {t("ctaPrimary")}
              <ArrowRightIcon size={16} />
            </a>
          </Button>

          <Button asChild size="lg" variant="outline">
            <a href={EXTERNAL_LINKS.sdkRepo} target="_blank" rel="noreferrer">
              <GithubLogoIcon size={16} />
              {t("ctaSecondary")}
            </a>
          </Button>
        </div>
      </div>
    </section>
  );
}
