import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/primitives/badge";
import type { UserActivityStatus } from "@/api-client/tracked-users/domain";
import { STATUS_COLOR } from "@/app/[locale]/(dashboard)/users/lib/status-ui";
import { cn } from "@/lib/cn";

type StatusBadgeProps = {
  status: UserActivityStatus;
  className?: string;
};

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
