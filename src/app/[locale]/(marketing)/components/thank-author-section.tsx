"use client";

import { ArrowSquareOutIcon, BankIcon, HeartIcon } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/layout/card";
import { Button } from "@/components/ui/primitives/button";

import { EXTERNAL_LINKS } from "../lib/external-links";
import { CopyButton } from "./copy-button";

/**
 * "Thank the author" section — two donation rails (Monobank UAH,
 * European SEPA EUR) plus a pointer to the footer for anything else.
 *
 * @remarks
 * Client Component because the EUR card relies on clipboard copy.
 * Account identifiers (IBAN / BIC / receiver / Monobank link) live in
 * {@link EXTERNAL_LINKS.donations} — they are not translated because
 * they're immutable wire strings. Only the surrounding copy in
 * `marketing.thankAuthor.*` is localised.
 */
export function ThankAuthorSection() {
  const t = useTranslations("marketing.thankAuthor");
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
              <dl className="space-y-2">
                {eurRows.map(({ labelKey, value }) => (
                  <div
                    key={labelKey}
                    className="border-border bg-muted/40 flex items-center gap-2 rounded-md border p-1.5 pl-3"
                  >
                    <div className="min-w-0 flex-1">
                      <dt className="text-muted-foreground text-xs">{t(labelKey)}</dt>
                      <dd className="text-foreground truncate font-mono text-sm tabular-nums md:text-base">{value}</dd>
                    </div>
                    <CopyButton value={value} label={t("eurCopyAria", { field: t(labelKey) })} />
                  </div>
                ))}
              </dl>
            </CardContent>
          </Card>
        </div>

        <p className="text-muted-foreground mt-10 text-center text-sm">
          {t.rich("otherWays", {
            contactLink: (chunks) => (
              <a
                href={`mailto:${EXTERNAL_LINKS.contact.email}`}
                className="text-foreground underline-offset-4 hover:underline"
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
