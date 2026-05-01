/**
 * Which sign-in methods are wired in this deployment.
 *
 * @remarks
 * Lives in `lib/` (not `server/`) because the FE consumes the shape too —
 * server pages derive the flags via `getEnabledProviders()` and pass
 * them as props into client components, which gate UI rendering on
 * the same source-of-truth values.
 *
 * `passkey` is always `true`. It isn't a primary sign-in method — it's
 * an add-on that users register from their settings after a first
 * primary-method sign-in. Gating it requires no env var, the field is
 * here for symmetry at consumption sites.
 *
 * The boot-time refine in `server/env.ts` guarantees at least one of
 * `google`, `github`, or `otp` is `true`.
 */
export type EnabledProviders = {
  google: boolean;
  github: boolean;
  otp: boolean;
  passkey: boolean;
};
