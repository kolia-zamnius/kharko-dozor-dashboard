import { GithubLogoIcon, LinkedinLogoIcon } from "@phosphor-icons/react/dist/ssr";
import { getTranslations } from "next-intl/server";
import Image from "next/image";

import { EXTERNAL_LINKS } from "../lib/external-links";

/**
 * Marketing footer — four columns on desktop collapsing to a stacked
 * layout on mobile. All copy lives in `marketing.footer.*`; the URLs
 * come from {@link EXTERNAL_LINKS} so flipping the docs destination
 * once the public docs site ships is a single-line change.
 *
 * @remarks
 * Icons are imported from `@phosphor-icons/react/dist/ssr` so they
 * render at HTML-response time without dragging the full Phosphor
 * SVG bundle into the Server Component graph.
 */
export async function MarketingFooter() {
  const t = await getTranslations("marketing.footer");
  const year = new Date().getFullYear();

  return (
    <footer className="border-border bg-muted/20 border-t">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.6fr_1fr_1fr]">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Image src="/assets/logo.svg" alt="" width={24} height={24} />
            <span className="text-sm font-semibold tracking-tight">Kharko Dozor</span>
          </div>
          <p className="text-muted-foreground max-w-sm text-sm">{t("tagline")}</p>
        </div>

        <div className="space-y-3">
          <h3 className="text-foreground text-sm font-semibold">{t("resourcesHeading")}</h3>
          <ul className="text-muted-foreground space-y-2 text-sm">
            <li>
              <a
                href={EXTERNAL_LINKS.sdkRepo}
                target="_blank"
                rel="noreferrer"
                className="hover:text-foreground transition-colors"
              >
                {t("resourcesGithub")}
              </a>
            </li>
            <li>
              <a
                href={EXTERNAL_LINKS.docs}
                target="_blank"
                rel="noreferrer"
                className="hover:text-foreground transition-colors"
              >
                {t("resourcesDocs")}
              </a>
            </li>
            <li>
              <a
                href={EXTERNAL_LINKS.npmSdk}
                target="_blank"
                rel="noreferrer"
                className="hover:text-foreground transition-colors"
              >
                {t("resourcesSdk")}
              </a>
            </li>
            <li>
              <a
                href={EXTERNAL_LINKS.npmSdkReact}
                target="_blank"
                rel="noreferrer"
                className="hover:text-foreground transition-colors"
              >
                {t("resourcesSdkReact")}
              </a>
            </li>
          </ul>
        </div>

        <div className="space-y-3">
          <h3 className="text-foreground text-sm font-semibold">{t("contactHeading")}</h3>
          <ul className="text-muted-foreground space-y-2 text-sm">
            <li>
              <a
                href={`mailto:${EXTERNAL_LINKS.contact.email}`}
                className="hover:text-foreground inline-flex items-center gap-2 transition-colors"
              >
                {EXTERNAL_LINKS.contact.email}
              </a>
            </li>
            <li>
              <a
                href={EXTERNAL_LINKS.contact.linkedin}
                target="_blank"
                rel="noreferrer"
                className="hover:text-foreground inline-flex items-center gap-2 transition-colors"
              >
                <LinkedinLogoIcon size={16} />
                {t("contactLinkedin")}
              </a>
            </li>
            <li>
              <a
                href={EXTERNAL_LINKS.contact.github}
                target="_blank"
                rel="noreferrer"
                className="hover:text-foreground inline-flex items-center gap-2 transition-colors"
              >
                <GithubLogoIcon size={16} />
                GitHub
              </a>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-border border-t">
        <div className="text-muted-foreground mx-auto max-w-6xl px-4 py-5 text-xs sm:px-6">
          {t("copyright", { year })}
        </div>
      </div>
    </footer>
  );
}
