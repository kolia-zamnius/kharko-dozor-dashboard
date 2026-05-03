import type { useTranslations } from "next-intl";

/**
 * Hand-written union (not JSON-derived) — narrows `string` from `searchParams`
 * into a typed key without a cast; misspellings fail at compile time.
 *
 * Deliberately omitted: `CredentialsSignin` (no credentials provider configured),
 * `SessionRequired` (surfaces on API routes, handled by the global redirect),
 * `Default` (Auth.js's unclassified — fallback copy matches).
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
