import { InfoIcon } from "@phosphor-icons/react/dist/ssr";
import { getTranslations } from "next-intl/server";

/**
 * Demo-mode disclosure banner — sits above the dashboard navbar on the
 * public demo instance only.
 *
 * @remarks
 * Renders only when `NEXT_PUBLIC_KHARKO_DEMO_MODE === "true"`. On a
 * self-hosted instance the env var is unset and the component returns
 * `null`, so it adds zero pixels and zero markup to the dashboard
 * shell. The Vercel demo deployment is the only place the variable is
 * set to `"true"` — see `.env.example` for the documented contract.
 *
 * The message has to make three things obvious at a glance to a
 * visitor evaluating the product:
 *
 *   1. **You're on a shared demo, not on your own instance.** Otherwise
 *      a careful reader notices the dashboard works and assumes
 *      "ah, this is the product, I should connect production data".
 *      That assumption is the failure case the banner exists to prevent.
 *   2. **Don't put real production data here.** Sessions on the demo
 *      live on the shared Neon database alongside everyone else's
 *      evaluation data. The demo can disappear or be reset at any time.
 *   3. **The path forward is self-hosting.** A direct link to the docs
 *      "Self-hosting" section closes the loop — visitor can immediately
 *      learn how to deploy their own.
 *
 * Visual style: amber/warning palette (not destructive — this is a
 * caveat, not an error), small sticky strip above the navbar so it
 * stays visible during scroll. Non-dismissible: a missed-once message
 * is worse than mild persistent noise, and self-hosters never see it.
 *
 * Hard-nav link to `/documentation/introduction` because
 * the docs zone lives outside the `[locale]/` pipeline. Locale prefix
 * on a `/documentation/*` URL would 404.
 */
export async function DemoBanner() {
  if (process.env.NEXT_PUBLIC_KHARKO_DEMO_MODE !== "true") return null;

  const t = await getTranslations("shell.demoBanner");

  return (
    <div className="border-b border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-100">
      <div className="flex items-center gap-2 px-4 py-2 text-xs">
        <InfoIcon size={16} className="shrink-0" />
        <p className="flex-1 truncate">
          <span className="font-medium">{t("label")}</span>
          <span className="mx-1.5 opacity-60">·</span>
          <span>{t("description")}</span>
        </p>
        {/* Hard nav: docs zone is outside the [locale]/ pipeline. */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- intentional hard nav (see comment above). */}
        <a
          href="/documentation/introduction"
          className="shrink-0 font-medium underline decoration-dotted underline-offset-4 hover:no-underline"
        >
          {t("cta")}
        </a>
      </div>
    </div>
  );
}
