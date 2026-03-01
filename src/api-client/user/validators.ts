import { z } from "zod";

import { LOCALES } from "@/i18n/config";

export const updateProfileSchema = z.object({
  name: z.string().min(2).max(50).trim(),
});

/**
 * Schema for `PATCH /api/user/locale`. The enum is derived from the
 * canonical `LOCALES` tuple in `src/i18n/config.ts` — adding or removing
 * a locale there propagates here automatically, so a stale client can
 * never set a locale value the server didn't register.
 */
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

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type UpdateLocaleInput = z.infer<typeof updateLocaleSchema>;
export type RenamePasskeyInput = z.infer<typeof renamePasskeySchema>;
export type DeleteAccountInput = z.infer<typeof deleteAccountSchema>;
