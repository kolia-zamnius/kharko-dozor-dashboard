import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { SignInForm } from "./components/sign-in-form";

/**
 * Static metadata composed per active locale — sourced from
 * `messages/<locale>/auth.json` so the browser tab picks up localised
 * copy without a client round-trip.
 */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth.page");
  return { title: t("signInTitle") };
}

/**
 * `/sign-in` — Server Component entry for the sign-in wizard.
 *
 * @remarks
 * Pure shell: awaits Next.js 16 async `searchParams`, forwards `error`
 * (Auth.js appends `?error=<code>` when a callback fails) and
 * `callbackUrl` to the client form. All behaviour lives inside
 * {@link SignInForm}.
 */
export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; callbackUrl?: string }>;
}) {
  const { error, callbackUrl } = await searchParams;
  return <SignInForm error={error} callbackUrl={callbackUrl} />;
}
