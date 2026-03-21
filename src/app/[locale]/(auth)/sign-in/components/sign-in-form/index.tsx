"use client";

import { OTPVerification } from "@/app/[locale]/(auth)/components/otp-verification";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { resolveAuthErrorMessage } from "./auth-errors";
import { EmailStep } from "./email-step";
import { MethodStep } from "./method-step";

/**
 * Typestate for the sign-in flow.
 *
 * Modelling the three steps as a discriminated union makes invalid
 * states (e.g. "method" step without an email, or "otp" step without
 * the passkey flag carried forward from "method") **unrepresentable**.
 * TypeScript narrows on `state.step` inside render branches, so every
 * read of `state.email` happens on a variant that actually has it.
 * This eliminates a whole class of bugs that the previous three-
 * parallel-useState shape permitted.
 *
 * `hasPasskey` is carried into the "otp" variant even though the OTP
 * screen itself doesn't display it — that way the "back" transition
 * to "method" doesn't have to re-query the server for passkey status.
 */
type SignInState =
  | { step: "email" }
  | { step: "method"; email: string; hasPasskey: boolean }
  | { step: "otp"; email: string; hasPasskey: boolean };

/**
 * Orchestrator for the sign-in flow.
 *
 * Responsibilities, and ONLY these:
 *   1. Hold the three-variant typestate (`email` → `method` → `otp`).
 *   2. Route to the correct step component per current state.
 *   3. Wire callbacks back from the step components to advance the
 *      state machine.
 *   4. Toast the Auth.js `?error=` query param on mount, if present.
 *
 * Everything else — form validation, OAuth, OTP rate-limit checks,
 * WebAuthn ceremonies, router navigation on passkey success — lives
 * inside the step components (`email-step.tsx`, `method-step.tsx`)
 * or the shared `OTPVerification` component. Each step knows how to
 * complete itself and reports results via callbacks; this file never
 * touches `signIn()`, `router`, or any server action directly.
 */
export function SignInForm({ error, callbackUrl = "/users" }: { error?: string; callbackUrl?: string }) {
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
        onOtpRequested={() => setState({ step: "otp", email: state.email, hasPasskey: state.hasPasskey })}
        onBack={() => setState({ step: "email" })}
      />
    );
  }

  return (
    <EmailStep
      callbackUrl={callbackUrl}
      onEmailResolved={(email, hasPasskey) => setState({ step: "method", email, hasPasskey })}
    />
  );
}
