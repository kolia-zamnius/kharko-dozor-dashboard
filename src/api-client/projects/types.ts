import type { z } from "zod";

import type { projectKeySchema, projectSchema } from "./response-schemas";

/**
 * Type barrel for the `projects` feature. See `response-schemas.ts`
 * for the wire contract and a note on why key-material brands
 * (`ApiKeyMasked` / `ApiKeyPlaintext`) don't appear in the DTO types.
 */

export type Project = z.infer<typeof projectSchema>;

/** Raw key — returned only by fetch-key and regenerate endpoints */
export type ProjectKey = z.infer<typeof projectKeySchema>;
