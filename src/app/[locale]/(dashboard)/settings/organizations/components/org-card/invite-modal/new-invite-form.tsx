import { Input } from "@/components/ui/forms/input";
import { Label } from "@/components/ui/forms/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/forms/select";
import { Button } from "@/components/ui/primitives/button";
import { INVITE_EXPIRY_DAYS } from "@/api-client/organizations/constants";
import { useInviteMemberMutation } from "@/api-client/organizations/mutations";
import type { Organization } from "@/api-client/organizations/types";
import { inviteSchema, type InviteInput } from "@/api-client/organizations/validators";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { Controller, useForm } from "react-hook-form";
import { INVITE_ROLE_OPTIONS } from "../../role-options";

/** Mutation invalidates the pending-invites query — table below refreshes on its own, no shared state needed. */
export function NewInviteForm({ org }: { org: Organization }) {
  const t = useTranslations("settings.orgs.invite");
  const tRoles = useTranslations("settings.orgs.roles");
  const inviteMember = useInviteMemberMutation();

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<InviteInput>({
    resolver: zodResolver(inviteSchema),
    defaultValues: { email: "", role: "VIEWER" },
    mode: "onChange",
  });

  function onSubmit(data: InviteInput) {
    inviteMember.mutate(
      { orgId: org.id, email: data.email, role: data.role },
      {
        onSuccess: () => reset({ email: "", role: data.role }),
      },
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
      {/*
       * Three-column grid: each field its own Label+control wrapper,
       * Send button in its own column bottom-aligned via flex.
       */}
      <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
        <div className="space-y-1.5">
          <Label htmlFor="invite-email">{t("emailLabel")}</Label>
          <Controller
            control={control}
            name="email"
            render={({ field }) => (
              <Input
                id="invite-email"
                placeholder={t("emailPlaceholder")}
                type="email"
                aria-invalid={!!errors.email}
                name={field.name}
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                ref={field.ref}
              />
            )}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="invite-role">{t("roleLabel")}</Label>
          <Controller
            control={control}
            name="role"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="invite-role" className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {INVITE_ROLE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {tRoles(`${opt.key}.label`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>

        <div className="flex items-end">
          <Button type="submit" disabled={inviteMember.isPending}>
            {t("submit")}
          </Button>
        </div>
      </div>

      {errors.email && <p className="text-destructive text-xs">{errors.email.message}</p>}

      {/*
       * Helper line explains the idempotent-resend semantic: the same
       * email can be submitted again to refresh an existing invite, no
       * manual revoke needed. Wording uses `INVITE_EXPIRY_DAYS` so copy
       * and server-side math can never drift.
       */}
      <p className="text-muted-foreground text-xs">{t("expiryNote", { days: INVITE_EXPIRY_DAYS })}</p>
    </form>
  );
}
