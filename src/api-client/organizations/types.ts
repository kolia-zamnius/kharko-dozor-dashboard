import type { z } from "zod";

import type { organizationInviteSchema, organizationMemberSchema, organizationSchema } from "./response-schemas";

export type Organization = z.infer<typeof organizationSchema>;
export type OrganizationMember = z.infer<typeof organizationMemberSchema>;
export type OrganizationInvite = z.infer<typeof organizationInviteSchema>;
