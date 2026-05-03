import { Button } from "@/components/ui/primitives/button";
import { GithubLogoIcon, GoogleLogoIcon } from "@phosphor-icons/react";
import { signIn } from "next-auth/react";

type OAuthFlags = {
  google: boolean;
  github: boolean;
};

/**
 * Renders only providers with env pairs set so a self-hoster who skipped one
 * doesn't end up with a button that crashes on click. `null` when neither is
 * enabled — caller skips its OAuth-section wrapper without a conditional.
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
