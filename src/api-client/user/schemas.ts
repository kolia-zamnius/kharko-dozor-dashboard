/**
 * Server routes `schema.parse(result)` right before `NextResponse.json(...)`
 * — a drifted Prisma select 500s here instead of leaking. Client doesn't
 * re-parse: same-origin server→browser isn't a threat boundary the way DB→server is.
 */

import { z } from "zod";

import { LOCALES } from "@/i18n/config";

export const userAccountSchema = z.object({
  provider: z.string(),
});

export const userPasskeySchema = z.object({
  credentialID: z.string(),
  name: z.string(),
  credentialDeviceType: z.enum(["singleDevice", "multiDevice"]),
  createdAt: z.string(),
});

export const userProfileSchema = z.object({
  id: z.string(),
  name: z.string().nullable(),
  email: z.string(),
  image: z.string(),
  createdAt: z.string(),
  accounts: z.array(userAccountSchema),
  passkeys: z.array(userPasskeySchema),
});

/** Narrow regenerate-avatar response — client patches the new URL into the cache without a second round-trip. */
export const userAvatarResponseSchema = z.object({
  image: z.string(),
});

export const updateProfileSchema = z.object({
  name: z.string().min(2).max(50).trim(),
});

/** Enum is derived from `LOCALES` — adding/removing a locale propagates here automatically. */
export const updateLocaleSchema = z.object({
  locale: z.enum(LOCALES),
});

export const renamePasskeySchema = z.object({
  name: z.string().min(1).max(50).trim(),
});

export const deleteAccountSchema = z.object({
  confirmation: z.literal("delete my account", {
    message: 'Please type "delete my account" to confirm',
  }),
});

export type UserAccount = z.infer<typeof userAccountSchema>;
export type UserPasskey = z.infer<typeof userPasskeySchema>;
export type UserProfile = z.infer<typeof userProfileSchema>;
export type UserAvatarResponse = z.infer<typeof userAvatarResponseSchema>;

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type UpdateLocaleInput = z.infer<typeof updateLocaleSchema>;
export type RenamePasskeyInput = z.infer<typeof renamePasskeySchema>;
export type DeleteAccountInput = z.infer<typeof deleteAccountSchema>;
