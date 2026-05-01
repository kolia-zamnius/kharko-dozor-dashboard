import { getEnabledProviders } from "@/server/auth/enabled-providers";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { SignUpForm } from "./components/sign-up-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth.page");
  return { title: t("signUpTitle") };
}

/**
 * `/sign-up` — Server Component entry for the sign-up wizard.
 *
 * @remarks
 * Pure shell: awaits Next.js 16 async `searchParams` and forwards
 * `callbackUrl` to the client form so deep-link flows (invite email,
 * protected-page redirect) land where they started after the OTP
 * callback completes. Provider flags drive which sign-up paths render.
 */
export default async function SignUpPage({ searchParams }: { searchParams: Promise<{ callbackUrl?: string }> }) {
  const { callbackUrl } = await searchParams;
  const enabled = getEnabledProviders();
  return <SignUpForm callbackUrl={callbackUrl} enabled={enabled} />;
}
