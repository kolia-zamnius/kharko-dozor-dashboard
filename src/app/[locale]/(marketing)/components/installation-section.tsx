import { ArrowSquareOutIcon } from "@phosphor-icons/react/dist/ssr";
import { getTranslations } from "next-intl/server";

import { Button } from "@/components/ui/primitives/button";
import { Link } from "@/i18n/navigation";

import { EXTERNAL_LINKS } from "../lib/external-links";
import { InstallTabs } from "./install-tabs";

/**
 * Installation / "how to start" section — three numbered steps, a
 * React/Vanilla-JS tabbed snippet pair (install command + minimal
 * usage sample), and two escape-hatch links (full docs + dashboard).
 *
 * @remarks
 * Server Component — heading, steps, and the docs/dashboard buttons
 * are static markup with server-resolved translations. The interactive
 * tab widget (Radix Tabs + `CopyButton`) lives in {@link InstallTabs},
 * a small client island; keeping it isolated stops the surrounding
 * copy from leaking into the client bundle and shortens the
 * marketing-page TBT.
 *
 * Each tab inside `InstallTabs` shows two blocks: (1) the `npm install`
 * line with a copy button for instant paste, and (2) a multi-line usage
 * snippet that actually demonstrates how to wire the SDK — matches the
 * section's "install in under a minute" promise. Usage snippets are
 * **not** copyable because developers need to adapt the `publicKey`
 * and wrapper placement to their own app; a copy button would falsely
 * imply drop-in code.
 *
 * Typed `Link` from `@/i18n/navigation` for the dashboard button
 * (locale-aware); docs link stays a plain `<a>` since external URLs
 * don't carry a locale. Phosphor icon comes from `/dist/ssr` so it
 * emits at HTML-response time.
 */
export async function InstallationSection() {
  const t = await getTranslations("marketing.installation");

  return (
    <section id="install" className="border-border scroll-mt-16 border-t">
      <div className="mx-auto max-w-4xl px-4 py-20 sm:px-6 md:py-24">
        <div className="mx-auto max-w-2xl space-y-3 text-center">
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">{t("heading")}</h2>
          <p className="text-muted-foreground text-base text-pretty">{t("subheading")}</p>
        </div>

        <ol className="mx-auto mt-12 max-w-2xl space-y-3">
          {(["step1", "step2", "step3"] as const).map((key, index) => (
            <li key={key} className="text-foreground/90 flex gap-4 text-sm">
              <span className="bg-primary/10 text-primary flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold">
                {index + 1}
              </span>
              <span className="pt-0.5 leading-relaxed">{t(key)}</span>
            </li>
          ))}
        </ol>

        <InstallTabs />

        <div className="mx-auto mt-8 flex max-w-2xl flex-wrap justify-center gap-3">
          <Button asChild variant="outline" size="sm">
            <a href={EXTERNAL_LINKS.docs} target="_blank" rel="noreferrer">
              <ArrowSquareOutIcon size={16} />
              {t("docsLink")}
            </a>
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link href="/users">{t("dashboardLink")}</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
