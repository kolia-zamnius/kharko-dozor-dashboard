import { UsersIcon } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";

/**
 * Empty state shown when no tracked users match the current filters,
 * or when the org has no tracked users at all.
 */
export function EmptyState({ hasFilters }: { hasFilters: boolean }) {
  const t = useTranslations("users.list.empty");
  return (
    <div className="flex flex-col items-center gap-3 py-16 text-center">
      <div className="bg-muted rounded-full p-3">
        <UsersIcon size={24} className="text-muted-foreground" />
      </div>
      {hasFilters ? (
        <>
          <p className="text-sm font-medium">{t("withFiltersTitle")}</p>
          <p className="text-muted-foreground text-xs">{t("withFiltersBody")}</p>
        </>
      ) : (
        <>
          <p className="text-sm font-medium">{t("noUsersTitle")}</p>
          <p className="text-muted-foreground max-w-xs text-xs">
            {t.rich("noUsersBody", {
              code: () => <code className="bg-muted rounded px-1 py-0.5 text-[11px]">identify()</code>,
            })}
          </p>
        </>
      )}
    </div>
  );
}
