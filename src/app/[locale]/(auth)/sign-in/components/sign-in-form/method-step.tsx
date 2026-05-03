import { checkOtpRateLimit } from "@/app/[locale]/(auth)/actions/auth";
import { Button } from "@/components/ui/primitives/button";
import { useRouter } from "@/i18n/navigation";
import type { EnabledProviders } from "@/lib/auth/enabled-providers";
import { FingerprintIcon } from "@phosphor-icons/react";
import { signIn } from "next-auth/react";
import { signIn as signInWithPasskey } from "next-auth/webauthn";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

type MethodStepProps = {
  email: string;
  hasPasskey: boolean;
  callbackUrl: string;
  enabled: EnabledProviders;
  /** Called once the OTP email is on its way — advances to the code-entry screen. */
  onOtpRequested: () => void;
  /** Called after the user cancels and wants to change email. */
  onBack: () => void;
};

/**
 * Passkey button shown disabled (not hidden) when `hasPasskey` is false —
 * educates the user about the feature and nudges Settings setup post-sign-in.
 * Passkey success is direct `router.push(callbackUrl)` (session live);
 * OTP-sent reports up via `onOtpRequested` so the orchestrator flips step.
 */
export function MethodStep({ email, hasPasskey, callbackUrl, enabled, onOtpRequested, onBack }: MethodStepProps) {
  const t = useTranslations("auth");
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  async function handleSendOtp() {
    setSubmitting(true);
    const rateLimitResult = await checkOtpRateLimit(email);
    if (rateLimitResult.ok && !rateLimitResult.data.allowed) {
      if (rateLimitResult.data.retryAfter) {
        toast.error(t("method.toast.cooldown", { seconds: rateLimitResult.data.retryAfter }));
      } else {
        toast.error(t("method.toast.dailyLimit"));
      }
      setSubmitting(false);
      return;
    }

    const result = await signIn("nodemailer", { email, redirect: false });
    if (result?.error) {
      toast.error(t("method.toast.sendFailed"));
      setSubmitting(false);
      return;
    }

    onOtpRequested();
    setSubmitting(false);
  }

  async function handlePasskey() {
    setSubmitting(true);
    const result = await signInWithPasskey("passkey", { redirect: false });

    if (result?.error) {
      toast.error(t("method.toast.passkeyFailed"));
      setSubmitting(false);
      return;
    }

    if (result?.ok) {
      router.push(callbackUrl);
    }
    setSubmitting(false);
  }

  return (
    <div className="w-full max-w-sm space-y-6">
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-bold tracking-tight">{t("method.title")}</h1>
        <p className="text-default-500 text-sm">{email}</p>
      </div>

      <div className="space-y-3">
        {enabled.otp && (
          <Button size="lg" className="w-full" onClick={handleSendOtp} disabled={submitting}>
            {submitting ? t("method.sendingCode") : t("method.sendOtpCode")}
          </Button>
        )}

        <div>
          <Button
            variant={enabled.otp ? "outline" : "default"}
            size="lg"
            className="w-full"
            onClick={handlePasskey}
            disabled={!hasPasskey || submitting}
          >
            <FingerprintIcon />
            {t("method.usePasskey")}
          </Button>
          {!hasPasskey && <p className="text-default-400 mt-1.5 text-center text-xs">{t("method.passkeyHint")}</p>}
        </div>
      </div>

      <Button variant="ghost" size="sm" className="w-full" onClick={onBack} disabled={submitting}>
        {t("shared.back")}
      </Button>
    </div>
  );
}
