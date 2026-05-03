import type { z } from "zod";

import type {
  userAccountSchema,
  userAvatarResponseSchema,
  userPasskeySchema,
  userProfileSchema,
} from "./response-schemas";

export type UserAccount = z.infer<typeof userAccountSchema>;
export type UserPasskey = z.infer<typeof userPasskeySchema>;
export type UserProfile = z.infer<typeof userProfileSchema>;
export type UserAvatarResponse = z.infer<typeof userAvatarResponseSchema>;
