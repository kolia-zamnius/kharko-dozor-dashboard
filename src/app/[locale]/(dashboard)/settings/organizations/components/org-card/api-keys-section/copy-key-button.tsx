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
 */
export function CopyKeyButton({ projectId }: { projectId: string }) {
  const t = useTranslations("settings.orgs.apiKeys");
  const [justCopied, setJustCopied] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleCopy() {
    if (loading || justCopied) return;
    setLoading(true);
    try {
      const key = await fetchProjectKey(projectId);
      await navigator.clipboard.writeText(key);
      setJustCopied(true);
      toast.success(t("copySuccess"));
      setTimeout(() => setJustCopied(false), 2000);
    } catch {
      toast.error(t("copyError"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button variant="ghost" size="icon-sm" aria-label={t("copyAria")} onClick={handleCopy} disabled={loading}>
      {justCopied ? <CheckIcon className="text-success" /> : <CopyIcon />}
    </Button>
  );
}
