/**
 * Wraps Chrome 132+'s `PublicKeyCredential.signalUnknownCredential` — tells the
 * browser a WebAuthn credential was revoked server-side so autofill drops it from
 * suggestions. Single localised `as` cast here because TS's `lib.dom.d.ts` hasn't
 * typed the method yet and constructor augmentation doesn't compose cleanly. Silent
 * on pre-Chrome-132 (`?.` feature detect) and on any thrown error — UX optimisation,
 * never block the user flow.
 */

type PublicKeyCredentialSignal = {
  signalUnknownCredential: (opts: { rpId: string; credentialId: string }) => Promise<void>;
};

export async function signalUnknownCredential(opts: { rpId: string; credentialId: string }): Promise<void> {
  const pk = globalThis.PublicKeyCredential as unknown as Partial<PublicKeyCredentialSignal> | undefined;
  try {
    await pk?.signalUnknownCredential?.(opts);
  } catch {
    // swallowed by design
  }
}
