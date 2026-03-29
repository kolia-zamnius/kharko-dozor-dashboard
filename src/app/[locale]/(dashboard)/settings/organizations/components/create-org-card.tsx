import { Button } from "@/components/ui/primitives/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/layout/card";
import { Input } from "@/components/ui/forms/input";
import { Label } from "@/components/ui/forms/label";
import { useCreateOrgMutation } from "@/api-client/organizations/mutations";
import { createOrgSchema, type CreateOrgInput } from "@/api-client/organizations/validators";
import { zodResolver } from "@hookform/resolvers/zod";
import { PlusIcon } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";

export function CreateOrgCard() {
  const t = useTranslations("settings.orgs.create");
  const createOrg = useCreateOrgMutation();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isValid },
  } = useForm<CreateOrgInput>({
    resolver: zodResolver(createOrgSchema),
    defaultValues: { name: "" },
    mode: "onChange",
  });

  function onSubmit(data: CreateOrgInput) {
    createOrg.mutate(data, { onSuccess: () => reset() });
  }

  return (
    <Card className="border-dashed">
      <CardHeader>
        <CardTitle className="text-base">{t("title")}</CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-2">
          <Label htmlFor="new-org-name">{t("nameLabel")}</Label>
          <div className="flex items-center gap-3">
            <Input
              id="new-org-name"
              placeholder={t("namePlaceholder")}
              className="flex-1"
              aria-invalid={!!errors.name}
              aria-describedby={errors.name ? "new-org-name-error" : undefined}
              {...register("name")}
            />
            <Button type="submit" disabled={!isValid || createOrg.isPending}>
              <PlusIcon />
              {t("submit")}
            </Button>
          </div>
          {errors.name && (
            <p id="new-org-name-error" className="text-destructive text-sm">
              {errors.name.message}
            </p>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
