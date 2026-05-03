import type { z } from "zod";

import type { userInviteSchema } from "./response-schemas";

export type UserInvite = z.infer<typeof userInviteSchema>;
