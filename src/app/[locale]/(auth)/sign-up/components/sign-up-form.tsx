"use client";

import { prepareSignUp } from "@/app/[locale]/(auth)/actions/auth";
import { OAuthButtons } from "@/app/[locale]/(auth)/components/oauth-buttons";
import { OTPVerification } from "@/app/[locale]/(auth)/components/otp-verification";
import { Button } from "@/components/ui/primitives/button";
import { Input } from "@/components/ui/forms/input";
import { Label } from "@/components/ui/forms/label";
import { Separator } from "@/components/ui/primitives/separator";
import { Link, useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { signUpSchema, type SignUpInput } from "@/app/[locale]/(auth)/validators";
import { zodResolver } from "@hookform/resolvers/zod";
import { signIn } from "next-auth/react";
import { useState } from "react";
import { useForm } from "react-hook-form";

/**
 * Typestate for the sign-up flow.
 *
 * @remarks
 * Modelled as a discriminated union so the `"otp"` variant cannot be
 * constructed without the email payload that the OTP screen needs — an
 * invariant that the previous `{ step, email }` parallel-useState
 * shape leaked. Matches the pattern used by `SignInForm` so both
 * wizards read the same way.
 */
type SignUpState = { step: "form" } | { step: "otp"; email: string };

/**
 * Sign-up wizard.
 *
 * @remarks
 * Two-step flow:
 *   1. `form` — collect name + email, call {@link prepareSignUp} to
 *      validate + cache the display name in a short-lived cookie, then
 *      trigger a Nodemailer OTP send.
 *   2. `otp` — delegate to the shared {@link OTPVerification}
 *      component, which hands off to `/api/auth/callback/nodemailer`
 *      on code entry. The name cookie is read by the PrismaAdapter's
 *      `createUser` override during that callback so the first-party
 *      name lands in the DB without a second round-trip.
 *
 * Error sentinels from `prepareSignUp` (`ACCOUNT_EXISTS`,
 * `RATE_LIMITED`) are translated to product copy + routing here,
 * keeping the server action free of user-facing strings.
 *
 * @see src/app/(auth)/actions/auth.ts — `prepareSignUp` server action
 * @see src/server/auth/adapter.ts — `createUser` override that consumes the cookie
 */
export function SignUpForm({ callbackUrl = "/users" }: { callbackUrl?: string }) {
  const t = useTranslations("auth");
  const router = useRouter();
  const [state, setState] = useState<SignUpState>({ step: "form" });
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignUpInput>({
    resolver: zodResolver(signUpSchema),
  });

  async function onSubmit(data: SignUpInput) {
    setSubmitting(true);
    const result = await prepareSignUp(data.name, data.email);

    if (!result.ok) {
      if (result.error === "ACCOUNT_EXISTS") {
        toast.info(t("signUp.toast.accountExists"));
        setSubmitting(false);
        router.push(callbackUrl !== "/users" ? `/sign-in?callbackUrl=${encodeURIComponent(callbackUrl)}` : "/sign-in");
        return;
      }
      if (result.error === "RATE_LIMITED") {
        toast.error(t("signUp.toast.rateLimited"));
        setSubmitting(false);
        return;
      }
      toast.error(result.error);
      setSubmitting(false);
      return;
    }

    const signInResult = await signIn("nodemailer", {
      email: data.email,
      redirect: false,
    });

    if (signInResult?.error) {
      toast.error(t("signUp.toast.sendFailed"));
      setSubmitting(false);
      return;
    }

    setState({ step: "otp", email: data.email });
    setSubmitting(false);
  }

  if (state.step === "otp") {
    return <OTPVerification email={state.email} callbackUrl={callbackUrl} onBack={() => setState({ step: "form" })} />;
  }

  return (
    <div className="w-full max-w-sm space-y-6">
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-bold tracking-tight">{t("signUp.title")}</h1>
        <p className="text-default-500 text-sm">{t("signUp.subtitle")}</p>
      </div>

      <OAuthButtons callbackUrl={callbackUrl} />

      <div className="flex items-center gap-3">
        <Separator className="flex-1" />
        <span className="text-default-500 text-xs">{t("shared.orContinueWithEmail")}</span>
        <Separator className="flex-1" />
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">{t("signUp.name.label")}</Label>
          <Input
            id="name"
            placeholder={t("signUp.name.placeholder")}
            autoComplete="name"
            aria-invalid={!!errors.name}
            aria-describedby={errors.name ? "signup-name-error" : undefined}
            {...register("name")}
          />
          {errors.name && (
            <p id="signup-name-error" className="text-destructive text-sm">
              {errors.name.message}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">{t("signUp.email.label")}</Label>
          <Input
            id="email"
            type="email"
            placeholder={t("signUp.email.placeholder")}
            autoComplete="email"
            aria-invalid={!!errors.email}
            aria-describedby={errors.email ? "signup-email-error" : undefined}
            {...register("email")}
          />
          {errors.email && (
            <p id="signup-email-error" className="text-destructive text-sm">
              {errors.email.message}
            </p>
          )}
        </div>

        <Button type="submit" size="lg" className="w-full" disabled={submitting}>
          {submitting ? t("signUp.submit.sending") : t("signUp.submit.continue")}
        </Button>
      </form>

      <p className="text-default-500 text-center text-sm">
        {t("signUp.haveAccountText")}{" "}
        <Link href="/sign-in" className="text-primary hover:underline">
          {t("signUp.signInLink")}
        </Link>
      </p>
    </div>
  );
}
