import { getEnabledProviders } from "@/server/auth/enabled-providers";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { SignUpForm } from "./components/sign-up-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth.page");
  return { title: t("signUpTitle") };
}

/** `callbackUrl` forwarded so deep-link flows (invite email, protected-page redirect) land back where they started after the OTP callback. */
export default async function SignUpPage({ searchParams }: { searchParams: Promise<{ callbackUrl?: string }> }) {
  const { callbackUrl } = await searchParams;
  const enabled = getEnabledProviders();
  return <SignUpForm callbackUrl={callbackUrl} enabled={enabled} />;
}
