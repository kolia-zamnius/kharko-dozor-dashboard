import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/layout/card";
import { Separator } from "@/components/ui/primitives/separator";
import type { UserProfile } from "@/api-client/user/schemas";
import { useTranslations } from "next-intl";
import { ConnectedAccounts } from "./connected-accounts";
import { PasskeyList } from "./passkey-list";

export function AuthenticationSection({ profile }: { profile: UserProfile }) {
  const t = useTranslations("settings.user.auth");
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        <PasskeyList passkeys={profile.passkeys} />
        <Separator />
        <ConnectedAccounts accounts={profile.accounts.filter((a) => a.provider !== "passkey")} />
      </CardContent>
    </Card>
  );
}
