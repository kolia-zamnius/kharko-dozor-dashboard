"use client";

import { CheckIcon, CopyIcon } from "@phosphor-icons/react";
import { useState } from "react";

import { Button } from "@/components/ui/primitives/button";
import { cn } from "@/lib/cn";

/**
 * Copy-to-clipboard icon button used by marketing installation snippets
 * and the EUR donation details. Renders a static ghost button with an
 * inline "copied" affordance — deliberately no toast, the feedback is
 * immediate and spatially close to the triggering element.
 *
 * @remarks
 * Kept local to the marketing zone (not a global primitive) because
 * the copy flow here is intentionally simpler than the dashboard one
 * in `copy-key-button.tsx`, which fetches plaintext on-demand and
 * surfaces sonner toasts. When a second marketing consumer needs a
 * different UX, the options diverge; until then, one button covers
 * both installation snippets and the bank-details card.
 */
export function CopyButton({
  value,
  label,
  className,
}: {
  /** Text copied to the clipboard when the button is pressed. */
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
      // Swallow: the browser may reject clipboard writes in some
      // contexts (non-secure origin, permission denied). The user
      // can still select the visible text and copy manually.
    }
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      aria-label={label}
      onClick={handleCopy}
      className={cn("shrink-0", className)}
    >
      {justCopied ? <CheckIcon /> : <CopyIcon />}
    </Button>
  );
}
