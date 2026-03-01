import type { z } from "zod";

import type {
  userAccountSchema,
  userAvatarResponseSchema,
  userPasskeySchema,
  userProfileSchema,
} from "./response-schemas";

/**
 * Type barrel for the `user` feature.
 *
 * @remarks
 * Types are inferred from the zod schemas in `response-schemas.ts` —
 * adding or removing a field is a one-place edit over there and the
 * types flow through automatically. Consumer imports stay pointed
 * here so no call site needs to care where the schema lives.
 */

export type UserAccount = z.infer<typeof userAccountSchema>;
export type UserPasskey = z.infer<typeof userPasskeySchema>;
export type UserProfile = z.infer<typeof userProfileSchema>;
export type UserAvatarResponse = z.infer<typeof userAvatarResponseSchema>;
