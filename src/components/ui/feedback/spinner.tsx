import * as React from "react";

import { cn } from "@/lib/cn";

/**
 * Shared loading spinner — pure CSS, no JS runtime, no `"use client"`.
 *
 * @remarks
 * Works in three contexts without modification: `loading.tsx` Server
 * Components (importing icon libs there fails), Client Components
 * reading TanStack Query state, and inline slots (toast icon, button
 * label, etc.).
 *
 * Color flows from `currentColor` via `border-current` — override with
 * any `text-*` class on self or parent. Override size with `size-*`
 * via `className`.
 *
 * Announces as `role="status" aria-label="Loading"`. Pass
 * `aria-hidden` when the surrounding container already carries its
 * own label (e.g. a submit button with text), to avoid SR double-talk.
 */
function Spinner({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      role="status"
      aria-label="Loading"
      data-slot="spinner"
      className={cn(
        "text-muted-foreground size-6 animate-spin rounded-full border-2 border-current/20 border-t-current",
        className,
      )}
      {...props}
    />
  );
}

export { Spinner };
