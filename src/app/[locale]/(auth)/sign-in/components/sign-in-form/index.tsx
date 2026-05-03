"use client";

import { OTPVerification } from "@/app/[locale]/(auth)/components/otp-verification";
import type { EnabledProviders } from "@/lib/auth/enabled-providers";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { resolveAuthErrorMessage } from "./auth-errors";
import { EmailStep } from "./email-step";
import { MethodStep } from "./method-step";

/**
 * Discriminated union — invalid states ("method" without email, "otp" without
 * the passkey flag) are unrepresentable. `hasPasskey` carried into "otp" so
 * the back transition doesn't re-query the server.
 */
type SignInState =
  | { step: "email" }
  | { step: "method"; email: string; hasPasskey: boolean }
  | { step: "otp"; email: string; hasPasskey: boolean };

/** Pure orchestrator — owns typestate + step routing. Form validation, OAuth, WebAuthn live in the step components. */
export function SignInForm({
  error,
  callbackUrl = "/users",
  enabled,
}: {
  error?: string;
  callbackUrl?: string;
  enabled: EnabledProviders;
}) {
  const tErrors = useTranslations("auth.signIn.authErrors");
  const [state, setState] = useState<SignInState>({ step: "email" });

  useEffect(() => {
    const message = resolveAuthErrorMessage(error, tErrors);
    if (message) toast.error(message);
  }, [error, tErrors]);

  if (state.step === "otp") {
    return (
      <OTPVerification
        email={state.email}
        callbackUrl={callbackUrl}
        onBack={() => setState({ step: "method", email: state.email, hasPasskey: state.hasPasskey })}
      />
    );
  }

  if (state.step === "method") {
    return (
      <MethodStep
        email={state.email}
        hasPasskey={state.hasPasskey}
        callbackUrl={callbackUrl}
        enabled={enabled}
        onOtpRequested={() => setState({ step: "otp", email: state.email, hasPasskey: state.hasPasskey })}
        onBack={() => setState({ step: "email" })}
      />
    );
  }

  return (
    <EmailStep
      callbackUrl={callbackUrl}
      enabled={enabled}
      onEmailResolved={(email, hasPasskey) => setState({ step: "method", email, hasPasskey })}
    />
  );
}
