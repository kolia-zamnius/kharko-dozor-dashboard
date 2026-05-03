import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/primitives/avatar";
import { Button } from "@/components/ui/primitives/button";
import { Separator } from "@/components/ui/primitives/separator";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/layout/card";
import { Input } from "@/components/ui/forms/input";
import { Label } from "@/components/ui/forms/label";
import { useRegenerateAvatarMutation, useUpdateProfileMutation } from "@/api-client/user/mutations";
import type { UserProfile } from "@/api-client/user/types";
import { updateProfileSchema, type UpdateProfileInput } from "@/api-client/user/validators";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowsClockwiseIcon } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";

/** RHF `values:` keeps the input synced to the post-invalidation snapshot. Avatar regen and name edit are independent mutations. */
export function ProfileSection({ profile }: { profile: UserProfile }) {
  const t = useTranslations("settings.user.profile");
  const updateProfile = useUpdateProfileMutation();
  const regenerateAvatar = useRegenerateAvatarMutation();

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty, isValid, isSubmitting },
  } = useForm<UpdateProfileInput>({
    resolver: zodResolver(updateProfileSchema),
    values: { name: profile.name ?? "" },
    mode: "onChange",
  });

  /**
   * Uses `mutateAsync` (not `mutate`) so `handleSubmit` sees a Promise
   * and tracks `isSubmitting` correctly.
   *
   * @remarks
   * Two knock-on effects we rely on:
   *   1. React Hook Form drops subsequent submit invocations while the
   *      first Promise is unresolved — the old `mutate()` call returned
   *      void, so `handleSubmit` thought the submit finished instantly
   *      and let double-clicks through.
   *   2. The button's `disabled` flag adds `isSubmitting` to the mix,
   *      which stays true until the mutation settles AND the
   *      `onSuccess` invalidation callback finishes. That closes the
   *      gap where `isPending === false` but the form hadn't re-synced
   *      to the new profile yet and `isDirty` was still true.
   */
  async function onSubmit(data: UpdateProfileInput) {
    await updateProfile.mutateAsync(data);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        <div className="flex items-center gap-4">
          <Avatar size="lg" className="size-16">
            <AvatarImage src={profile.image} alt={profile.name ?? t("avatarFallback")} />
            <AvatarFallback />
          </Avatar>
          <Button
            variant="outline"
            size="sm"
            onClick={() => regenerateAvatar.mutate()}
            disabled={regenerateAvatar.isPending}
          >
            <ArrowsClockwiseIcon />
            {t("regenerateAvatar")}
          </Button>
        </div>

        <Separator />

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">{t("nameLabel")}</Label>
            <Input
              id="name"
              placeholder={t("namePlaceholder")}
              aria-invalid={!!errors.name}
              aria-describedby={errors.name ? "profile-name-error" : undefined}
              {...register("name")}
            />
            {errors.name && (
              <p id="profile-name-error" className="text-destructive text-sm">
                {errors.name.message}
              </p>
            )}
          </div>

          <Button type="submit" size="sm" disabled={!isDirty || !isValid || isSubmitting || updateProfile.isPending}>
            {t("saveName")}
          </Button>
        </form>

        <Separator />

        <div className="space-y-1.5">
          <p className="text-sm font-medium">{t("emailHeading")}</p>
          <p className="text-muted-foreground text-sm">{profile.email}</p>
          <p className="text-muted-foreground text-xs">{t("emailNote")}</p>
        </div>
      </CardContent>
    </Card>
  );
}
