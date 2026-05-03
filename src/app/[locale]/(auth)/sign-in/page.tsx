import { getEnabledProviders } from "@/server/auth/enabled-providers";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { SignInForm } from "./components/sign-in-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth.page");
  return { title: t("signInTitle") };
}

/**
 * Auth.js appends `?error=<code>` when a callback fails — forwarded as a prop
 * so the client form renders the right banner. Provider flags resolved
 * server-side so the form only shows methods this instance has configured.
 */
export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; callbackUrl?: string }>;
}) {
  const { error, callbackUrl } = await searchParams;
  const enabled = getEnabledProviders();
  return <SignInForm error={error} callbackUrl={callbackUrl} enabled={enabled} />;
}
