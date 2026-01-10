/**
 * Feature-detected wrapper around `PublicKeyCredential.signalUnknownCredential`.
 *
 * @remarks
 * Chrome 132+ lets a relying party tell the browser / OS that a
 * WebAuthn credential it remembers has been revoked server-side,
 * so the autofill picker drops it from future suggestions. The
 * method lives on the static side of `PublicKeyCredential`, but
 * TypeScript's bundled `lib.dom.d.ts` hasn't declared it yet
 * (the lib is conservative about new Web APIs).
 *
 * Attempting to augment the global constructor directly is brittle
 * — lib.dom.d.ts exposes `PublicKeyCredential` both as an instance
 * type (interface) and as a `var` constructor, and extending the
 * constructor via module augmentation doesn't compose cleanly with
 * the existing declaration. Instead we do the one localised `as`
 * cast here, behind a narrowly-typed wrapper that every call site
 * can import — the cast is a single grep-able line, not scattered
 * inline.
 *
 * Silent on pre-Chrome-132 browsers (`?.` feature detect) and on
 * any thrown error — this is a UX optimisation, never worth
 * interrupting the user flow.
 */

type PublicKeyCredentialSignal = {
  signalUnknownCredential: (opts: { rpId: string; credentialId: string }) => Promise<void>;
};

export async function signalUnknownCredential(opts: { rpId: string; credentialId: string }): Promise<void> {
  const pk = globalThis.PublicKeyCredential as unknown as Partial<PublicKeyCredentialSignal> | undefined;
  try {
    await pk?.signalUnknownCredential?.(opts);
  } catch {
    // Intentionally swallowed — caller is already running post-
    // success, nothing to surface.
  }
}
