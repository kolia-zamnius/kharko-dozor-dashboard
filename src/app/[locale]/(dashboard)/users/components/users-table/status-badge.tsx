import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/primitives/badge";
import type { UserActivityStatus } from "@/api-client/tracked-users/status";
import { STATUS_COLOR } from "@/app/[locale]/(dashboard)/users/lib/status-ui";
import { cn } from "@/lib/cn";

type StatusBadgeProps = {
  status: UserActivityStatus;
  className?: string;
};

/**
 * Colored status pill for the users table. Pure view — the status is
 * derived on the server and passed as a prop, so this component never
 * calls a hook or computes thresholds.
 */
export function StatusBadge({ status, className }: StatusBadgeProps) {
  const t = useTranslations("users.status");
  const color = STATUS_COLOR[status];

  return (
    <Badge variant="outline" className={cn("gap-1.5", className)}>
      <span className={cn("inline-block size-1.5 rounded-full", color.dot)} />
      <span className={color.text}>{t(`${status}.label`)}</span>
    </Badge>
  );
}
