import type { z } from "zod";

import type { userInviteSchema } from "./response-schemas";

/**
 * Type barrel for the `user-invites` feature. Inferred from the zod
 * schema in `response-schemas.ts`; see that file for the note on why
 * `role` keeps the full `OWNER | ADMIN | VIEWER` union here vs. the
 * narrower admin-side `OrganizationInvite`.
 */

export type UserInvite = z.infer<typeof userInviteSchema>;
