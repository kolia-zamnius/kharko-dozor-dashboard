import { Button } from "@/components/ui/primitives/button";
import { GithubLogoIcon, GoogleLogoIcon } from "@phosphor-icons/react";
import { signIn } from "next-auth/react";

/**
 * Google + GitHub shortcut buttons shared by the sign-in and sign-up
 * landing screens.
 *
 * @remarks
 * `signIn(provider, { callbackUrl })` defers to Auth.js to handle the
 * full OAuth dance (redirect, callback, session cookie). `callbackUrl`
 * is threaded through so deep-link navigation (e.g. from an invite
 * email) survives the round-trip.
 */
export function OAuthButtons({ callbackUrl = "/users" }: { callbackUrl?: string }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <Button variant="outline" size="lg" className="w-full" onClick={() => signIn("google", { callbackUrl })}>
        <GoogleLogoIcon />
        Google
      </Button>
      <Button variant="outline" size="lg" className="w-full" onClick={() => signIn("github", { callbackUrl })}>
        <GithubLogoIcon />
        GitHub
      </Button>
    </div>
  );
}
