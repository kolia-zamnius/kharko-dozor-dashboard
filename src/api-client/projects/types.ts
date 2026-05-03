import type { z } from "zod";

import type { projectKeySchema, projectSchema } from "./response-schemas";

export type Project = z.infer<typeof projectSchema>;
export type ProjectKey = z.infer<typeof projectKeySchema>;
