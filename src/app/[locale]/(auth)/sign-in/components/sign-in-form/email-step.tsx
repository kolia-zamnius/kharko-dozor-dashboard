import { prepareSignIn } from "@/app/[locale]/(auth)/actions/auth";
import { OAuthButtons } from "@/app/[locale]/(auth)/components/oauth-buttons";
import { signInSchema, type SignInInput } from "@/app/[locale]/(auth)/validators";
import { Input } from "@/components/ui/forms/input";
import { Label } from "@/components/ui/forms/label";
import { Button } from "@/components/ui/primitives/button";
import { Separator } from "@/components/ui/primitives/separator";
import { Link, useRouter } from "@/i18n/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

type EmailStepProps = {
  callbackUrl: string;
  /**
   * Called when the email has been successfully verified and the server
   * reported back whether the user has a passkey registered. The
   * orchestrator uses this to transition into the "method" step with
   * the payload baked into its state machine.
   */
  onEmailResolved: (email: string, hasPasskey: boolean) => void;
};

/**
 * First screen of the sign-in flow: OAuth shortcuts on top, an email
 * input below with a "Continue" button.
 *
 * Owns its own form state and submission logic. On a successful server
 * `prepareSignIn` call it reports the resolved email + passkey flag
 * back to the orchestrator via `onEmailResolved`. The orchestrator is
 * responsible for advancing the typestate; this component just knows
 * "I have an email, what's next".
 *
 * Error paths (account not found, rate-limited) are handled locally
 * with toasts + routing, since the orchestrator doesn't need to track
 * those — they either reset the form or navigate away from sign-in.
 */
export function EmailStep({ callbackUrl, onEmailResolved }: EmailStepProps) {
  const t = useTranslations("auth");
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignInInput>({ resolver: zodResolver(signInSchema) });

  async function onSubmit(data: SignInInput) {
    setSubmitting(true);
    const result = await prepareSignIn(data.email);

    if (!result.ok) {
      if (result.error === "ACCOUNT_NOT_FOUND") {
        toast.info(t("signIn.toast.accountNotFound"));
        setSubmitting(false);
        router.push(callbackUrl !== "/users" ? `/sign-up?callbackUrl=${encodeURIComponent(callbackUrl)}` : "/sign-up");
        return;
      }
      if (result.error === "RATE_LIMITED") {
        toast.error(t("signIn.toast.rateLimited"));
        setSubmitting(false);
        return;
      }
      toast.error(result.error);
      setSubmitting(false);
      return;
    }

    onEmailResolved(data.email, result.data.hasPasskey);
    setSubmitting(false);
  }

  return (
    <div className="w-full max-w-sm space-y-6">
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-bold tracking-tight">{t("signIn.welcomeTitle")}</h1>
        <p className="text-default-500 text-sm">{t("signIn.welcomeSubtitle")}</p>
      </div>

      <OAuthButtons callbackUrl={callbackUrl} />

      <div className="flex items-center gap-3">
        <Separator className="flex-1" />
        <span className="text-default-500 text-xs">{t("shared.orContinueWithEmail")}</span>
        <Separator className="flex-1" />
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">{t("signIn.email.label")}</Label>
          <Input
            id="email"
            type="email"
            placeholder={t("signIn.email.placeholder")}
            autoComplete="email"
            aria-invalid={!!errors.email}
            aria-describedby={errors.email ? "signin-email-error" : undefined}
            {...register("email")}
          />
          {errors.email && (
            <p id="signin-email-error" className="text-destructive text-sm">
              {errors.email.message}
            </p>
          )}
        </div>

        <Button type="submit" size="lg" className="w-full" disabled={submitting}>
          {submitting ? t("signIn.submit.checking") : t("signIn.submit.continue")}
        </Button>
      </form>

      <p className="text-default-500 text-center text-sm">
        {t("signIn.noAccountText")}{" "}
        <Link href="/sign-up" className="text-primary hover:underline">
          {t("signIn.signUpLink")}
        </Link>
      </p>
    </div>
  );
}
