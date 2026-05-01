"use client";

import { useTranslations } from "next-intl";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/navigation/tabs";

import { CopyButton } from "./copy-button";

/**
 * Interactive client island for the installation snippet — a Radix
 * tabs widget that swaps between the React and Vanilla JS variants of
 * `npm install` + a usage sample.
 *
 * @remarks
 * Lifted out of {@link InstallationSection} so the surrounding copy
 * (heading, numbered steps, escape-hatch buttons) stays in the server
 * component graph. Only this widget needs the Radix runtime + the
 * `CopyButton` clipboard handler; pulling everything into a single
 * client component would needlessly hydrate the static text around it
 * and inflate the marketing-page TBT.
 *
 * Translations come from the same `marketing.installation` namespace
 * the parent reads on the server — the `NextIntlClientProvider`
 * mounted at the locale layout makes the hook resolve to the same
 * messages without re-fetching.
 */
export function InstallTabs() {
  const t = useTranslations("marketing.installation");

  return (
    <Tabs defaultValue="vanilla" className="mx-auto mt-10 max-w-2xl">
      <TabsList className="self-center">
        <TabsTrigger value="vanilla">{t("tabs.vanilla")}</TabsTrigger>
        <TabsTrigger value="react">{t("tabs.react")}</TabsTrigger>
      </TabsList>

      <TabsContent value="vanilla" className="space-y-3">
        <InstallCommand command={t("vanillaInstall")} copyAria={t("copyCommandAria")} />
        <UsageSnippet code={VANILLA_USAGE} />
      </TabsContent>
      <TabsContent value="react" className="space-y-3">
        <InstallCommand command={t("reactInstall")} copyAria={t("copyCommandAria")} />
        <UsageSnippet code={REACT_USAGE} />
      </TabsContent>
    </Tabs>
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
    <DozorProvider
      options={{
        apiKey: process.env.NEXT_PUBLIC_DOZOR_KEY!,
        endpoint: "https://kharko-dozor.vercel.app/api/ingest",
      }}
    >
      <YourApp />
    </DozorProvider>
  );
}`;

const VANILLA_USAGE = `import { Dozor } from "@kharko/dozor";

Dozor.init({
  apiKey: "dp_...",
  endpoint: "https://kharko-dozor.vercel.app/api/ingest",
});`;
