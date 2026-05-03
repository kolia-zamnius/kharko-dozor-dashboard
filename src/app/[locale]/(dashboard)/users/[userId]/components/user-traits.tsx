import { CaretDownIcon, CheckIcon, CopyIcon } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/ui/primitives/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/layout/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/layout/collapsible";
import { toast } from "sonner";

type UserTraitsProps = {
  traits: Record<string, unknown> | null;
};

/** Keys ordered by surfacing priority — first matches take first slots. */
const PRIORITY_KEYS = ["email", "name", "displayName", "plan", "role", "company", "country"];
const MAX_INLINE_ROWS = 4;

function pickInlineEntries(traits: Record<string, unknown>): Array<[string, unknown]> {
  const entries = Object.entries(traits);
  const priority: Array<[string, unknown]> = [];
  const rest: Array<[string, unknown]> = [];
  const prioritySet = new Set(PRIORITY_KEYS);

  for (const e of entries) {
    if (prioritySet.has(e[0])) priority.push(e);
    else rest.push(e);
  }

  // Preserve PRIORITY_KEYS order for the priority slice
  priority.sort((a, b) => PRIORITY_KEYS.indexOf(a[0]) - PRIORITY_KEYS.indexOf(b[0]));

  return [...priority, ...rest].slice(0, MAX_INLINE_ROWS);
}

/** Compact serialise — table row constraint. Full pretty-print lives in the expanded view. */
function formatInlineValue(value: unknown): string {
  if (value === null) return "null";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

/** Returns `null` when traits are absent — a permanent empty card on the MVP path reads worse than no card. */
export function UserTraits({ traits }: UserTraitsProps) {
  const t = useTranslations("users.detail.traits");
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!traits || Object.keys(traits).length === 0) {
    return null;
  }

  const inlineEntries = pickInlineEntries(traits);
  const totalKeys = Object.keys(traits).length;
  const hasMore = totalKeys > inlineEntries.length;
  const json = JSON.stringify(traits, null, 2);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(json);
      setCopied(true);
      toast.success(t("toastCopySuccess"));
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error(t("toastCopyError"));
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <CardAction>
          <span className="text-muted-foreground text-xs">{t("keyCount", { count: totalKeys })}</span>
        </CardAction>
      </CardHeader>
      <CardContent className="pb-4">
        <dl className="grid grid-cols-[minmax(0,auto)_1fr] gap-x-6 gap-y-1.5 text-sm">
          {inlineEntries.map(([key, value]) => (
            <div key={key} className="contents">
              <dt className="text-muted-foreground truncate font-mono text-xs" title={key}>
                {key}
              </dt>
              <dd className="truncate" title={formatInlineValue(value)}>
                {formatInlineValue(value)}
              </dd>
            </div>
          ))}
        </dl>

        {/* We always render the Collapsible (not just when hasMore) so users
            can copy full JSON even for users with ≤ MAX_INLINE_ROWS traits. */}
        <Collapsible open={open} onOpenChange={setOpen} className="mt-3">
          <div className="flex items-center justify-between gap-2">
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="-ml-2 gap-1"
                aria-expanded={open}
                aria-controls="user-traits-full"
              >
                <CaretDownIcon
                  weight="regular"
                  className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`}
                />
                {open ? t("hideJson") : hasMore ? t("showAll", { count: totalKeys }) : t("showJson")}
              </Button>
            </CollapsibleTrigger>
            <Button variant="ghost" size="sm" onClick={handleCopy} aria-label={t("copyAria")} className="gap-1">
              {copied ? <CheckIcon weight="regular" /> : <CopyIcon weight="regular" />}
              {copied ? t("copied") : t("copyJson")}
            </Button>
          </div>
          <CollapsibleContent id="user-traits-full">
            <pre className="border-border bg-muted/40 mt-2 max-h-80 overflow-auto rounded-md border p-3 font-mono text-xs leading-relaxed">
              {json}
            </pre>
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
}
