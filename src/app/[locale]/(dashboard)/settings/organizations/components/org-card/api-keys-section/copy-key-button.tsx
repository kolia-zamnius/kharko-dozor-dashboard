import { Button } from "@/components/ui/primitives/button";
import { fetchProjectKey } from "@/api-client/projects/queries";
import { CheckIcon, CopyIcon } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

/**
 * Plaintext key never enters the React Query cache or component state — exists
 * briefly between fetch and clipboard write. Single discriminated `status`
 * (not two booleans) makes `loading && copied` unrepresentable.
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
