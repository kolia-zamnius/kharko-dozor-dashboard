import type { UserAccount } from "@/api-client/user/types";
import { GithubLogoIcon, GoogleLogoIcon } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";
import { DisconnectAccountDialog } from "./disconnect-account-dialog";

/**
 * Provider label + icon map. Keys match the stable Auth.js provider ids
 * sent from the server; labels are brand names and stay English across
 * every locale ("Google" and "GitHub" don't localise).
 */
const PROVIDER_META: Record<string, { label: string; icon: typeof GoogleLogoIcon }> = {
  google: { label: "Google", icon: GoogleLogoIcon },
  github: { label: "GitHub", icon: GithubLogoIcon },
};

export function ConnectedAccounts({ accounts }: { accounts: UserAccount[] }) {
  const t = useTranslations("settings.user.accounts");
  return (
    <div className="space-y-3">
      <p className="text-sm font-medium">{t("heading")}</p>

      {accounts.length === 0 ? (
        <p className="text-muted-foreground text-sm">{t("empty")}</p>
      ) : (
        <div className="space-y-2">
          {accounts.map((account) => {
            const meta = PROVIDER_META[account.provider];
            const Icon = meta?.icon;
            const label = meta?.label ?? account.provider;
            return (
              <div
                key={account.provider}
                className="border-border flex items-center justify-between rounded-lg border px-3 py-2"
              >
                <div className="flex items-center gap-3">
                  {Icon && <Icon className="text-muted-foreground size-5" />}
                  <p className="text-sm font-medium">{label}</p>
                </div>
                <DisconnectAccountDialog provider={account.provider} providerLabel={label} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
