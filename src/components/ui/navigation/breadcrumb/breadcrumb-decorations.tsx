"use client";

import * as React from "react";
import { CaretRightIcon, DotsThreeIcon } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";

import { cn } from "@/lib/cn";

function BreadcrumbSeparator({ children, className, ...props }: React.ComponentProps<"li">) {
  return (
    <li
      data-slot="breadcrumb-separator"
      role="presentation"
      aria-hidden="true"
      className={cn("[&>svg]:size-3.5", className)}
      {...props}
    >
      {children ?? <CaretRightIcon />}
    </li>
  );
}

function BreadcrumbEllipsis({ className, ...props }: React.ComponentProps<"span">) {
  const t = useTranslations("components.breadcrumb");
  return (
    <span
      data-slot="breadcrumb-ellipsis"
      role="presentation"
      aria-hidden="true"
      className={cn("flex size-5 items-center justify-center [&>svg]:size-4", className)}
      {...props}
    >
      <DotsThreeIcon />
      <span className="sr-only">{t("more")}</span>
    </span>
  );
}

export { BreadcrumbSeparator, BreadcrumbEllipsis };
