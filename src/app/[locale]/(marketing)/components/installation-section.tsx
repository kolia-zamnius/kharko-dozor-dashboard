"use client";

import { ArrowSquareOutIcon } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/primitives/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/navigation/tabs";
import { Link } from "@/i18n/navigation";

import { EXTERNAL_LINKS } from "../lib/external-links";
import { CopyButton } from "./copy-button";

/**
 * Installation / "how to start" section — three numbered steps, a
 * React/Vanilla-JS tabbed snippet pair (install command + minimal
 * usage sample), and two escape-hatch links (full docs + dashboard).
 *
 * @remarks
 * Each tab shows two blocks: (1) the `npm install` line with a copy
 * button for instant paste, and (2) a multi-line usage snippet that
 * actually demonstrates how to wire the SDK — matches the section's
 * "install in under a minute" promise. Usage snippets are **not**
 * copyable because developers need to adapt the `publicKey` and
 * wrapper placement to their own app; a copy button would falsely
 * imply drop-in code.
 *
 * Client Component because Radix Tabs is client-only and the install
 * command's copy button needs clipboard access. Typed `Link` from
 * `@/i18n/navigation` for the dashboard button (locale-aware);
 * docs link stays a plain `<a>` since external URLs don't carry a
 * locale.
 */
export function InstallationSection() {
  const t = useTranslations("marketing.installation");

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

        <Tabs defaultValue="react" className="mx-auto mt-10 max-w-2xl">
          <TabsList className="self-center">
            <TabsTrigger value="react">{t("tabs.react")}</TabsTrigger>
            <TabsTrigger value="vanilla">{t("tabs.vanilla")}</TabsTrigger>
          </TabsList>

          <TabsContent value="react" className="space-y-3">
            <InstallCommand command={t("reactInstall")} copyAria={t("copyCommandAria")} />
            <UsageSnippet code={REACT_USAGE} />
          </TabsContent>
          <TabsContent value="vanilla" className="space-y-3">
            <InstallCommand command={t("vanillaInstall")} copyAria={t("copyCommandAria")} />
            <UsageSnippet code={VANILLA_USAGE} />
          </TabsContent>
        </Tabs>

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

/**
 * Single-line install command with a copy button. The command is
 * verbatim across locales (npm package paths are universal), but the
 * surrounding chrome — including the copy-button aria-label — still
 * flows through translations so screen-reader users hear the action
 * in their UI language.
 */
function InstallCommand({ command, copyAria }: { command: string; copyAria: string }) {
  return (
    <div className="border-border bg-muted/40 flex items-center gap-2 rounded-lg border p-1 pl-4">
      <code className="text-foreground flex-1 truncate font-mono text-sm">
        <span className="text-muted-foreground select-none">$ </span>
        {command}
      </code>
      <CopyButton value={command} label={copyAria} />
    </div>
  );
}

/**
 * Multi-line usage code block. No copy button — developers must adapt
 * the `publicKey` and wrapper placement, and a one-click copy would
 * ship broken code.
 */
function UsageSnippet({ code }: { code: string }) {
  return (
    <pre className="border-border bg-muted/40 overflow-x-auto rounded-lg border p-4 font-mono text-sm leading-relaxed">
      <code className="text-foreground">{code}</code>
    </pre>
  );
}

const REACT_USAGE = `import { DozorProvider } from "@kharko/dozor-react";

export default function App() {
  return (
    <DozorProvider publicKey={process.env.NEXT_PUBLIC_DOZOR_KEY!}>
      <YourApp />
    </DozorProvider>
  );
}`;

const VANILLA_USAGE = `import { init } from "@kharko/dozor";

init({
  publicKey: "dp_...",
});`;
