import { z } from "zod";

/**
 * Output DTOs. Server routes parse `schema.parse(result)` right before
 * `NextResponse.json(...)` so a silently-drifted Prisma select (extra field,
 * missing field) becomes an explicit 500 instead of a silent leak. We don't
 * re-parse on the client — same-origin server→browser isn't a threat boundary
 * the way the DB boundary is.
 */

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
