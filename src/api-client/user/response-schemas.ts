import { z } from "zod";

/**
 * Zod schemas for the `user` feature's response DTOs.
 *
 * @remarks
 * Twin of `validators.ts` — where `validators.ts` describes what the
 * server ACCEPTS (request bodies, query params), this module describes
 * what the server RETURNS. Route handlers call
 * `schema.parse(result)` right before `NextResponse.json(...)` so a
 * silently-drifted Prisma select (extra field, missing field) becomes
 * an explicit 500 instead of a silent leak or client crash.
 *
 * Consumer contract:
 *   - Server routes: `return NextResponse.json(userProfileSchema.parse(result))`.
 *   - Client types: `types.ts` re-exports `z.infer<typeof schema>` so the
 *     TypeScript shape and the runtime validator share **one** source of
 *     truth. Adding a field means editing the schema here — the type
 *     picks it up automatically.
 *
 * We don't parse on the client side: the server already validated, and
 * re-parsing every payload would double the work for no additional
 * guarantee (the network layer between same-origin server + browser
 * isn't a threat boundary the way the DB boundary is).
 *
 * @see src/api-client/user/validators.ts — twin schema file for INPUTS.
 * @see src/app/api/user/route.ts — `GET /api/user` consumer.
 * @see src/app/api/user/avatar/route.ts — `POST /api/user/avatar` consumer.
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

/**
 * `POST /api/user/avatar` — regenerate avatar URL (DiceBear `shapes`
 * style, deterministic by id + timestamp nonce). Returns only the new
 * image URL; the client patches it into the TanStack cache without a
 * second round-trip.
 */
export const userAvatarResponseSchema = z.object({
  image: z.string(),
});
