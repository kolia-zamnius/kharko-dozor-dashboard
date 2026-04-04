import type { Icon as PhosphorIcon } from "@phosphor-icons/react";
import { BrowsersIcon, PlayCircleIcon, ShieldCheckIcon, UsersThreeIcon } from "@phosphor-icons/react/dist/ssr";
import { getTranslations } from "next-intl/server";

import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/layout/card";

/**
 * Four-up feature grid beneath the hero. Config-driven so each card
 * is a single line of table data — reordering or adding features is
 * a copy-paste of the object, no JSX surgery.
 *
 * @remarks
 * Icons come from `@phosphor-icons/react/dist/ssr` (the SSR-safe entry
 * — keeps features off the client bundle entirely). Translation keys
 * are typed via the `marketing.features` namespace, so a missing card
 * copy surfaces as a compile error rather than a runtime blank cell.
 */
type FeatureKey = "sessionReplay" | "trackedUsers" | "slices" | "privacy";

/**
 * Feature config inline on purpose — the FeaturesSection is the sole
 * consumer today. Rule of three: lift to
 * `src/app/[locale]/(marketing)/lib/features.ts` when a second
 * consumer shows up (candidates: a dynamic OG image that lists
 * features, a future about/pricing page, sitemap anchors per
 * feature). Premature extraction now would just add indirection
 * without a real payoff.
 */
const FEATURES: ReadonlyArray<{ key: FeatureKey; Icon: PhosphorIcon }> = [
  { key: "sessionReplay", Icon: PlayCircleIcon },
  { key: "trackedUsers", Icon: UsersThreeIcon },
  { key: "slices", Icon: BrowsersIcon },
  { key: "privacy", Icon: ShieldCheckIcon },
];

export async function FeaturesSection() {
  const t = await getTranslations("marketing.features");

  return (
    <section className="border-border border-t">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 md:py-24">
        <div className="mx-auto max-w-2xl space-y-3 text-center">
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">{t("heading")}</h2>
          <p className="text-muted-foreground text-base text-pretty">{t("subheading")}</p>
        </div>

        <div className="mt-12 grid gap-4 sm:grid-cols-2">
          {FEATURES.map(({ key, Icon }) => (
            <Card key={key} className="h-full">
              <CardHeader>
                <div className="bg-primary/10 text-primary flex size-10 items-center justify-center rounded-lg">
                  <Icon size={22} />
                </div>
                <CardTitle className="mt-2">{t(`${key}.title`)}</CardTitle>
                <CardDescription>{t(`${key}.description`)}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
