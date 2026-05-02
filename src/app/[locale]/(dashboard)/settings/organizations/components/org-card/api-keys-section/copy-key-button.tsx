import { Button } from "@/components/ui/primitives/button";
import { fetchProjectKey } from "@/api-client/projects/queries";
import { CheckIcon, CopyIcon } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

/**
 * Fetches the plaintext API key on-demand and copies it to clipboard.
 * The raw value never enters the React Query cache or the React tree —
 * it exists briefly in JS memory only between fetch and clipboard write.
 *
 * @remarks
 * Status is a single discriminated value rather than two booleans so
 * the impossible `loading && copied` state is unrepresentable AND the
 * transition `loading → copied` is direct (no one-frame all-false flash
 * a `[loading, justCopied]` pair would produce in the `finally` block).
 */
type CopyStatus = "idle" | "loading" | "copied";

export function CopyKeyButton({ projectId }: { projectId: string }) {
  const t = useTranslations("settings.orgs.apiKeys");
  const [status, setStatus] = useState<CopyStatus>("idle");

  async function handleCopy() {
    if (status !== "idle") return;
    setStatus("loading");
    try {
      const key = await fetchProjectKey(projectId);
      await navigator.clipboard.writeText(key);
      setStatus("copied");
      toast.success(t("copySuccess"));
      setTimeout(() => setStatus("idle"), 2000);
    } catch {
      toast.error(t("copyError"));
      setStatus("idle");
    }
  }

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label={t("copyAria")}
      onClick={handleCopy}
      disabled={status === "loading"}
    >
      {status === "copied" ? <CheckIcon className="text-success" /> : <CopyIcon />}
    </Button>
  );
}
