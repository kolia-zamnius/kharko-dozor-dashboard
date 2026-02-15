"use client";

import * as React from "react";
import { DotsThreeIcon } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";

import { cn } from "@/lib/cn";

function PaginationEllipsis({ className, ...props }: React.ComponentProps<"span">) {
  const t = useTranslations("components.pagination");
  return (
    <span
      aria-hidden
      data-slot="pagination-ellipsis"
      className={cn("flex size-8 items-center justify-center [&_svg:not([class*='size-'])]:size-4", className)}
      {...props}
    >
      <DotsThreeIcon />
      <span className="sr-only">{t("more")}</span>
    </span>
  );
}

export { PaginationEllipsis };
