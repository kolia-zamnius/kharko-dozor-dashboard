import { ArrowSquareOutIcon, BankIcon, HeartIcon } from "@phosphor-icons/react/dist/ssr";
import { getTranslations } from "next-intl/server";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/layout/card";
import { Button } from "@/components/ui/primitives/button";

import { EXTERNAL_LINKS } from "../lib/external-links";
import { CopyButton } from "./copy-button";

/**
 * "Thank the author" section — two donation rails (Monobank UAH,
 * European SEPA EUR) plus a pointer to the footer for anything else.
 *
 * @remarks
 * Server Component — every visible element is static markup with
 * server-resolved translations. The only interactive surface is the
 * EUR-row clipboard button, which lives in its own `CopyButton` client
 * island; keeping the section server-rendered eliminates the
 * surrounding copy and card chrome from the client bundle and
 * shortens the marketing-page TBT.
 *
 * Account identifiers (IBAN / BIC / receiver / Monobank link) live in
 * {@link EXTERNAL_LINKS.donations} — they are not translated because
 * they're immutable wire strings. Only the surrounding copy in
 * `marketing.thankAuthor.*` is localised. Phosphor icons come from the
 * `/dist/ssr` entry so they emit at HTML-response time without a
 * client-side hydration cost.
 */
export async function ThankAuthorSection() {
  const t = await getTranslations("marketing.thankAuthor");
  const { monobank, eur } = EXTERNAL_LINKS.donations;

  const eurRows: ReadonlyArray<{ labelKey: "eurIbanLabel" | "eurBicLabel" | "eurReceiverLabel"; value: string }> = [
    { labelKey: "eurIbanLabel", value: eur.iban },
    { labelKey: "eurBicLabel", value: eur.bic },
    { labelKey: "eurReceiverLabel", value: eur.receiver },
  ];

  return (
    <section className="border-border border-t">
      <div className="mx-auto max-w-4xl px-4 py-20 sm:px-6 md:py-24">
        <div className="mx-auto max-w-2xl space-y-3 text-center">
          <div className="bg-primary/10 text-primary mx-auto flex size-12 items-center justify-center rounded-full">
            <HeartIcon size={24} />
          </div>
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">{t("heading")}</h2>
          <p className="text-muted-foreground text-base text-pretty">{t("subheading")}</p>
        </div>

        <div className="mt-12 grid gap-4 md:grid-cols-2">
          <Card className="flex h-full flex-col">
            <CardHeader>
              <CardTitle>🇺🇦 {t("uahTitle")}</CardTitle>
              <CardDescription>{t("uahDescription")}</CardDescription>
            </CardHeader>
            <CardContent className="mt-auto">
              <Button asChild size="lg" className="w-full">
                <a href={monobank} target="_blank" rel="noreferrer">
                  <ArrowSquareOutIcon size={16} />
                  {t("uahCta")}
                </a>
              </Button>
            </CardContent>
          </Card>

          <Card className="flex h-full flex-col">
            <CardHeader>
              <div className="flex items-center gap-2">
                <BankIcon size={20} className="text-muted-foreground" />
                <CardTitle>{t("eurTitle")}</CardTitle>
              </div>
              <CardDescription>{t("eurDescription")}</CardDescription>
            </CardHeader>
            <CardContent>
              {/* Plain rows rather than `<dl>/<dt>/<dd>` — axe/Lighthouse
                  reject `<dl>` whose row containers hold anything besides
                  `<dt>/<dd>` (the `<CopyButton>` sibling triggers
                  `definition-list` / `dlitem` failures), and the visual
                  label-value pairing is conveyed clearly by layout
                  alone. The label is associated with the value through
                  proximity + the per-row `aria-label` on the copy button
                  ("Copy IBAN" etc.), so screen-reader users still hear
                  the field name when they reach the action. */}
              <ul className="space-y-2">
                {eurRows.map(({ labelKey, value }) => (
                  <li
                    key={labelKey}
                    className="border-border bg-muted/40 flex items-center gap-2 rounded-md border p-1.5 pl-3"
                  >
                    <div className="min-w-0 flex-1">
                      <span className="text-muted-foreground block text-xs">{t(labelKey)}</span>
                      <span className="text-foreground block truncate font-mono text-sm tabular-nums md:text-base">
                        {value}
                      </span>
                    </div>
                    <CopyButton value={value} label={t("eurCopyAria", { field: t(labelKey) })} />
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>

        <p className="text-muted-foreground mt-10 text-center text-sm">
          {t.rich("otherWays", {
            contactLink: (chunks) => (
              <a
                href={`mailto:${EXTERNAL_LINKS.contact.email}`}
                className="text-foreground underline underline-offset-4"
              >
                {chunks}
              </a>
            ),
          })}
        </p>
      </div>
    </section>
  );
}
