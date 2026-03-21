import type { useTranslations } from "next-intl";

/**
 * Maps Auth.js `?error=<code>` values that bounce back to `/sign-in`
 * into the corresponding key inside the `auth.signIn.authErrors`
 * message namespace.
 *
 * @remarks
 * Auth.js forwards its own enum of failure modes via a query param;
 * the sign-in page reads it, passes it here with a scoped translator
 * (`useTranslations("auth.signIn.authErrors")`), and we either return
 * a localised sentence or `null` when the code is empty.
 *
 * The `AuthErrorCode` union is hand-written rather than derived from
 * the JSON schema because (a) these are fixed Auth.js codes, not
 * free-form app strings, and (b) it lets us narrow `string` inputs
 * from `searchParams` into a typed key without a cast — misspelt keys
 * become a compile error at the authoring site. Anything not in
 * `KNOWN_CODES` falls back to `fallback`. Deliberate omissions from
 * the known set:
 *   - `CredentialsSignin` — no credentials provider is configured, so
 *      this code should never reach the UI; fallback copy is fine.
 *   - `SessionRequired` — surfaces on protected API routes, not
 *      `/sign-in`; handled by the global auth-kind redirect.
 *   - `Default` — Auth.js emits this for unclassified failures; the
 *      fallback copy already matches its intent.
 *
 * The translator is injected (not resolved inside) so this module
 * stays free of `"use client"` and is callable from any caller
 * already in client context without doubling up on hook registrations.
 */
type AuthErrorCode =
  | "OAuthSignin"
  | "OAuthCallback"
  | "OAuthCreateAccount"
  | "Callback"
  | "EmailSignin"
  | "Verification"
  | "AccessDenied"
  | "Configuration";

const KNOWN_CODES: ReadonlySet<AuthErrorCode> = new Set<AuthErrorCode>([
  "OAuthSignin",
  "OAuthCallback",
  "OAuthCreateAccount",
  "Callback",
  "EmailSignin",
  "Verification",
  "AccessDenied",
  "Configuration",
]);

function isKnownCode(code: string): code is AuthErrorCode {
  return KNOWN_CODES.has(code as AuthErrorCode);
}

type AuthErrorsTranslator = ReturnType<typeof useTranslations<"auth.signIn.authErrors">>;

export function resolveAuthErrorMessage(code: string | undefined, t: AuthErrorsTranslator): string | null {
  if (!code) return null;
  return isKnownCode(code) ? t(code) : t("fallback");
}
