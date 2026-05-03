import type { Icon as PhosphorIcon } from "@phosphor-icons/react";
import { BrowsersIcon, PlayCircleIcon, ShieldCheckIcon, UsersThreeIcon } from "@phosphor-icons/react/dist/ssr";
import { getTranslations } from "next-intl/server";

import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/layout/card";

type FeatureKey = "sessionReplay" | "trackedUsers" | "slices" | "privacy";

/** Inline because this is the sole consumer — lift to `lib/features.ts` if a second one shows up. */
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
