import { checkOtpRateLimit } from "@/app/[locale]/(auth)/actions/auth";
import { OTP_COOLDOWN_SECONDS, OTP_LENGTH } from "@/lib/auth/otp.constants";
import { Button } from "@/components/ui/primitives/button";
import { InputOTP, InputOTPGroup, InputOTPSeparator, InputOTPSlot } from "@/components/ui/forms/input-otp";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type OTPVerificationProps = {
  email: string;
  callbackUrl?: string;
  onBack: () => void;
};

/**
 * Verification is imperative navigation (not `fetch`) — Auth.js contract for
 * email-OTP providers requires a full browser navigation so the session
 * cookie sets and the user lands on `callbackUrl`.
 *
 * `useRouter` from `next/navigation` (NOT `@/i18n/navigation`) — target is
 * `/api/auth/callback/...`, outside `[locale]/`; the intl router would apply
 * locale-prefix logic to a path that must stay untouched.
 */
export function OTPVerification({ email, callbackUrl = "/replays", onBack }: OTPVerificationProps) {
  const t = useTranslations("auth");
  const router = useRouter();
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(OTP_COOLDOWN_SECONDS);

  const cooldownActive = cooldown > 0;
  useEffect(() => {
    if (!cooldownActive) return;
    const timer = setInterval(() => {
      setCooldown((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldownActive]);

  function handleComplete(otp: string) {
    if (verifying) return;
    setVerifying(true);
    const params = new URLSearchParams({ token: otp, email, callbackUrl });
    // Path must match the provider id registered in `server/auth/providers.ts`
    // — `nodemailer`. `/callback/resend` would 404 at the Auth.js layer.
    router.replace(`/api/auth/callback/nodemailer?${params.toString()}`);
  }

  async function handleResend() {
    setResending(true);
    const rateLimitResult = await checkOtpRateLimit(email);
    if (rateLimitResult.ok && !rateLimitResult.data.allowed) {
      if (rateLimitResult.data.retryAfter) {
        setCooldown(rateLimitResult.data.retryAfter);
        toast.error(t("otp.toast.cooldown"));
      } else {
        toast.error(t("otp.toast.dailyLimit"));
      }
      setResending(false);
      return;
    }

    const result = await signIn("nodemailer", { email, redirect: false });
    if (result?.error) {
      toast.error(t("otp.toast.resendFailed"));
    } else {
      toast.success(t("otp.toast.newCodeSent"));
      setCooldown(OTP_COOLDOWN_SECONDS);
      setCode("");
    }
    setResending(false);
  }

  return (
    <div className="w-full max-w-sm space-y-6">
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-bold tracking-tight">{t("otp.title")}</h1>
        <p className="text-default-500 text-sm">
          {t.rich("otp.subtitle", {
            email,
            strong: (chunks) => <span className="text-foreground font-medium">{chunks}</span>,
          })}
        </p>
      </div>

      <div className="flex justify-center">
        <InputOTP
          value={code}
          onChange={setCode}
          onComplete={handleComplete}
          maxLength={OTP_LENGTH}
          disabled={verifying}
        >
          <InputOTPGroup>
            <InputOTPSlot index={0} />
            <InputOTPSlot index={1} />
            <InputOTPSlot index={2} />
          </InputOTPGroup>
          <InputOTPSeparator />
          <InputOTPGroup>
            <InputOTPSlot index={3} />
            <InputOTPSlot index={4} />
            <InputOTPSlot index={5} />
          </InputOTPGroup>
        </InputOTP>
      </div>

      {verifying && (
        <p className="text-default-500 text-center text-sm" aria-live="polite">
          {t("otp.verifying")}
        </p>
      )}

      <div className="flex flex-col items-center gap-3">
        <Button variant="ghost" size="sm" onClick={handleResend} disabled={cooldown > 0 || resending || verifying}>
          {cooldown > 0
            ? t("otp.resendCooldown", { seconds: cooldown })
            : resending
              ? t("otp.resendSending")
              : t("otp.resend")}
        </Button>

        <Button variant="ghost" size="sm" onClick={onBack} disabled={verifying}>
          {t("shared.back")}
        </Button>
      </div>
    </div>
  );
}
