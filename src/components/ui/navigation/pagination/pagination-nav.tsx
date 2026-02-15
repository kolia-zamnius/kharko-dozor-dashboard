"use client";

import * as React from "react";
import { CaretLeftIcon, CaretRightIcon } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";

import { cn } from "@/lib/cn";
import { PaginationLink } from "./pagination-link";

function PaginationPrevious({
  className,
  text,
  ...props
}: React.ComponentProps<typeof PaginationLink> & { text?: string }) {
  const t = useTranslations("components.pagination");
  return (
    <PaginationLink aria-label={t("previousAriaLabel")} size="default" className={cn("pl-1.5!", className)} {...props}>
      <CaretLeftIcon data-icon="inline-start" />
      <span className="hidden sm:block">{text ?? t("previous")}</span>
    </PaginationLink>
  );
}

function PaginationNext({
  className,
  text,
  ...props
}: React.ComponentProps<typeof PaginationLink> & { text?: string }) {
  const t = useTranslations("components.pagination");
  return (
    <PaginationLink aria-label={t("nextAriaLabel")} size="default" className={cn("pr-1.5!", className)} {...props}>
      <span className="hidden sm:block">{text ?? t("next")}</span>
      <CaretRightIcon data-icon="inline-end" />
    </PaginationLink>
  );
}

export { PaginationPrevious, PaginationNext };
