/**
 * Client gates UI rendering on these flags too — `getEnabledProviders()` resolves
 * them on the server and passes as props. `passkey` is always `true` (add-on
 * registered from Settings, not an entry path). Boot-time refine in
 * {@link src/server/env.ts} guarantees at least one of google/github/otp.
 */
export type EnabledProviders = {
  google: boolean;
  github: boolean;
  otp: boolean;
  passkey: boolean;
};
