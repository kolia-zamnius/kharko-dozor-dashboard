"use client";

import { CheckIcon, CopyIcon } from "@phosphor-icons/react";
import { useState } from "react";

import { Button } from "@/components/ui/primitives/button";
import { cn } from "@/lib/cn";

/**
 * Marketing-local — distinct from the dashboard's `copy-key-button.tsx`,
 * which fetches plaintext + toasts. Sized `icon` (32×32, not `icon-sm`) for
 * Lighthouse's mobile tap-target threshold.
 */
export function CopyButton({
  value,
  label,
  className,
}: {
  value: string;
  /** Accessible name — typically the localised "Copy {field}" string. */
  label: string;
  className?: string;
}) {
  const [justCopied, setJustCopied] = useState(false);

  async function handleCopy() {
    if (justCopied) return;
    try {
      await navigator.clipboard.writeText(value);
      setJustCopied(true);
      setTimeout(() => setJustCopied(false), 2000);
    } catch {
      // Browser may reject clipboard writes (non-secure origin, permission denied) — user can still select + copy manually.
    }
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label={label}
      onClick={handleCopy}
      className={cn("shrink-0", className)}
    >
      {justCopied ? <CheckIcon /> : <CopyIcon />}
    </Button>
  );
}
