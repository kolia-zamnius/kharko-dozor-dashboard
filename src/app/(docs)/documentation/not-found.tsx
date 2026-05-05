import Link from "next/link";

import { buttonVariants } from "fumadocs-ui/components/ui/button";
import { ArrowLeftIcon, BookOpenIcon } from "lucide-react";

import { cn } from "@/lib/cn";

/**
 * `(docs)`-scoped so it inherits the docs shell instead of bubbling to
 * `global-not-found.tsx` (which would render a localised dashboard 404 — wrong
 * for an English-only zone). Plain `next/link` — typed `i18n/navigation` would
 * locale-prefix to `/uk/documentation/...` which doesn't exist.
 */
export default function DocumentationNotFound() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 px-8 py-24 text-center">
      <p className="text-fd-muted-foreground text-7xl font-bold tracking-tight">404</p>
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Page not found</h1>
        <p className="text-fd-muted-foreground max-w-md text-sm">
          The page you&apos;re looking for doesn&apos;t exist, has moved, or never made it into the docs in the first
          place.
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Link href="/documentation/introduction" className={cn(buttonVariants({ variant: "primary" }), "gap-2")}>
          <BookOpenIcon className="size-4" />
          Get started
        </Link>
        <a
          href="https://github.com/kolia-zamnius/kharko-dozor-dashboard/issues"
          target="_blank"
          rel="noreferrer"
          className={cn(buttonVariants({ variant: "secondary" }), "gap-2")}
        >
          <ArrowLeftIcon className="size-4" />
          Report a broken link
        </a>
      </div>
    </div>
  );
}
