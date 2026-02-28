import type { z } from "zod";

import type { organizationInviteSchema, organizationMemberSchema, organizationSchema } from "./response-schemas";

/**
 * Type barrel for the `organizations` feature. Types are inferred
 * from zod schemas in `response-schemas.ts` — see that file for the
 * wire contract and role-narrowing notes. Consumer imports land here
 * so call sites don't need to track whether the type comes from a
 * schema or a hand-written interface.
 */

export type Organization = z.infer<typeof organizationSchema>;
export type OrganizationMember = z.infer<typeof organizationMemberSchema>;
export type OrganizationInvite = z.infer<typeof organizationInviteSchema>;
