import { Button } from "@/components/ui/primitives/button";
import { useRegisterPasskeyMutation } from "@/api-client/user/mutations";
import type { UserPasskey } from "@/api-client/user/types";
import { useFormatters } from "@/lib/use-formatters";
import { FingerprintIcon, PencilSimpleIcon } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { PasskeyDeleteDialog } from "./passkey-delete-dialog";
import { PasskeyRenameModal } from "./passkey-rename-modal";

export function PasskeyList({ passkeys }: { passkeys: UserPasskey[] }) {
  const t = useTranslations("settings.user.passkeys");
  const { formatDate } = useFormatters();
  const registerPasskey = useRegisterPasskeyMutation();
  const [renamingPasskey, setRenamingPasskey] = useState<{ credentialID: string; name: string } | null>(null);

  const deviceLabel = (type: UserPasskey["credentialDeviceType"]) =>
    type === "multiDevice" ? t("deviceTypeMulti") : t("deviceTypeSingle");

  return (
    <>
      <div className="space-y-3">
        <p className="text-sm font-medium">{t("heading")}</p>

        {passkeys.length === 0 ? (
          <p className="text-muted-foreground text-sm">{t("empty")}</p>
        ) : (
          <div className="space-y-2">
            {passkeys.map((passkey) => (
              <div
                key={passkey.credentialID}
                className="border-border flex items-center justify-between rounded-lg border px-3 py-2"
              >
                <div className="flex items-center gap-3">
                  <FingerprintIcon className="text-muted-foreground size-5" />
                  <div>
                    <p className="text-sm font-medium">{passkey.name}</p>
                    <p className="text-muted-foreground text-xs">
                      {deviceLabel(passkey.credentialDeviceType)}
                      {" · "}
                      {formatDate(passkey.createdAt)}
                    </p>
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={t("renameAria")}
                    onClick={() => setRenamingPasskey({ credentialID: passkey.credentialID, name: passkey.name })}
                  >
                    <PencilSimpleIcon />
                  </Button>
                  <PasskeyDeleteDialog passkey={passkey} />
                </div>
              </div>
            ))}
          </div>
        )}

        <Button
          variant="outline"
          size="sm"
          onClick={() => registerPasskey.mutate()}
          disabled={registerPasskey.isPending}
        >
          <FingerprintIcon />
          {t("addButton")}
        </Button>
      </div>

      {renamingPasskey && (
        <PasskeyRenameModal
          credentialID={renamingPasskey.credentialID}
          currentName={renamingPasskey.name}
          onClose={() => setRenamingPasskey(null)}
        />
      )}
    </>
  );
}
