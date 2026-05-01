import { Button } from "@/components/ui/primitives/button";
import { GithubLogoIcon, GoogleLogoIcon } from "@phosphor-icons/react";
import { signIn } from "next-auth/react";

type OAuthFlags = {
  google: boolean;
  github: boolean;
};

/**
 * Google + GitHub shortcut buttons shared by the sign-in and sign-up
 * landing screens. Renders only the buttons whose env pairs are set on
 * the running instance, so a self-hoster who skipped a provider doesn't
 * end up with a button that crashes on click.
 *
 * @remarks
 * `signIn(provider, { callbackUrl })` defers to Auth.js to handle the
 * full OAuth dance (redirect, callback, session cookie). `callbackUrl`
 * is threaded through so deep-link navigation (e.g. from an invite
 * email) survives the round-trip.
 *
 * Layout adapts to the count: one provider → full-width single button,
 * two → 2-col grid. Returns `null` when neither is enabled, so the
 * caller can skip rendering its own OAuth-section wrapper (header +
 * separator) without a wrapper conditional in every consumer.
 */
export function OAuthButtons({
  enabled,
  callbackUrl = "/users",
}: {
  enabled: OAuthFlags;
  callbackUrl?: string;
}) {
  if (!enabled.google && !enabled.github) return null;

  const single = enabled.google !== enabled.github;
  const layout = single ? "grid grid-cols-1 gap-3" : "grid grid-cols-2 gap-3";

  return (
    <div className={layout}>
      {enabled.google && (
        <Button variant="outline" size="lg" className="w-full" onClick={() => signIn("google", { callbackUrl })}>
          <GoogleLogoIcon />
          Google
        </Button>
      )}
      {enabled.github && (
        <Button variant="outline" size="lg" className="w-full" onClick={() => signIn("github", { callbackUrl })}>
          <GithubLogoIcon />
          GitHub
        </Button>
      )}
    </div>
  );
}
