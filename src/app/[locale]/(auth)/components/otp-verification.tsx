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
 * Shared OTP entry screen — consumed by both sign-in and sign-up
 * wizards as the terminal step.
 *
 * @remarks
 * Owns three pieces of local state:
 *   - `code` — 6-digit buffer driven by {@link InputOTP}.
 *   - `verifying` — gate set on `onComplete` so the user can't trigger
 *      a second navigation while the callback is in flight.
 *   - `cooldown` — seconds until the user may request a fresh code.
 *      Seeded from `OTP_COOLDOWN_SECONDS`, reset to the precise
 *      `retryAfter` returned by the server when the rate-limit probe
 *      reports a cooldown.
 *
 * Verification is an imperative navigation (not `fetch`) to
 * `/api/auth/callback/nodemailer?token=…` — that's the Auth.js contract
 * for email-OTP providers. The full browser navigation is what lets
 * Auth.js set the session cookie and land the user on `callbackUrl`.
 *
 * Note: `useRouter` here is deliberately imported from `next/navigation`
 * rather than `@/i18n/navigation` because the target is an API route
 * (`/api/auth/callback/…`) that sits outside the `[locale]/` segment;
 * passing it through the intl-aware router would apply locale-prefix
 * logic to a path that must remain untouched.
 */
export function OTPVerification({ email, callbackUrl = "/users", onBack }: OTPVerificationProps) {
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
    // Callback path must match the provider id registered in
    // `server/auth/providers.ts`. After the Resend → Nodemailer migration
    // the id is `"nodemailer"`; hitting `/callback/resend` surfaces
    // `Provider with id "resend" not found` at the Auth.js layer.
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
            email: () => <span className="text-foreground font-medium">{email}</span>,
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
