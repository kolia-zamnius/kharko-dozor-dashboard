import "server-only";

import { z } from "zod";

/**
 * Zod schemas + body parser for `POST /api/ingest`.
 *
 * @remarks
 * Kept in a sibling file so the route reads as a named-step pipeline
 * rather than 50 lines of validation prelude.
 */

const eventSchema = z.object({
  type: z.number(),
  data: z.unknown(),
  timestamp: z.number(),
  sliceIndex: z.number().int().min(0).optional(),
});

const sliceMarkerSchema = z.object({
  index: z.number().int().min(0),
  reason: z.enum(["init", "idle", "navigation"]),
  startedAt: z.number(),
  url: z.string(),
  pathname: z.string(),
  viewportWidth: z.number().optional(),
  viewportHeight: z.number().optional(),
});

const userIdentitySchema = z.object({
  userId: z.string().min(1).max(255),
  traits: z.record(z.string(), z.unknown()).optional(),
});

/**
 * Full ingest envelope.
 *
 * @remarks
 * `pageViews` is kept for backward compat with old SDK builds — the
 * server ignores it, but rejecting the payload for an extra legacy
 * key would brick customers pinned to old tracker versions.
 */
export const ingestSchema = z.object({
  sessionId: z.string().uuid(),
  events: z.array(eventSchema).max(500),
  metadata: z
    .object({
      url: z.string(),
      referrer: z.string(),
      userAgent: z.string(),
      screenWidth: z.number(),
      screenHeight: z.number(),
      language: z.string(),
      userIdentity: userIdentitySchema.optional(),
    })
    .optional(),
  pageViews: z.array(z.unknown()).optional(),
  sliceMarkers: z.array(sliceMarkerSchema).optional(),
});

export type IngestPayload = z.infer<typeof ingestSchema>;
export type IngestEvent = IngestPayload["events"][number];
export type IngestSliceMarker = NonNullable<IngestPayload["sliceMarkers"]>[number];
export type IngestMetadata = IngestPayload["metadata"];

/**
 * Read the request body, transparently decompressing gzip payloads.
 *
 * @remarks
 * The tracker SDK gzips batches above a few KB (5-10x egress savings).
 * Returns `unknown` on purpose — caller runs `ingestSchema.parse()`
 * so malformed payloads fail with per-field errors instead of a
 * generic `"Unexpected token"` from `JSON.parse`.
 *
 * @param req - The incoming `POST /api/ingest` request.
 * @returns Parsed JSON body — still unvalidated, pass to `ingestSchema.parse`.
 */
export async function parseIngestBody(req: Request): Promise<unknown> {
  if (req.headers.get("Content-Encoding") === "gzip") {
    const decoder = new DecompressionStream("gzip");
    const decompressed = req.body!.pipeThrough(decoder);
    const text = await new Response(decompressed).text();
    return JSON.parse(text);
  }
  return req.json();
}
