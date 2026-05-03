import { InfoIcon } from "@phosphor-icons/react/dist/ssr";
import { getTranslations } from "next-intl/server";

/**
 * Renders only when `NEXT_PUBLIC_KHARKO_DEMO_MODE === "true"` (set on the
 * Vercel demo only — self-hosted instances unset → `null` → zero markup).
 * Non-dismissible by design — a missed-once warning is worse than mild
 * persistent noise.
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
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- docs zone is outside `[locale]/`, locale prefix would 404. */}
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
