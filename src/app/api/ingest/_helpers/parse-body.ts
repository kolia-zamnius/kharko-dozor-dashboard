import "server-only";

import { z } from "zod";

import { HttpError } from "@/server/http-error";

/**
 * Gzip-bomb guard. Vercel caps compressed at 4.5 MB; rrweb gzip ratio is
 * 5-10×, so 10 MB decompressed sits above realistic batches (500 events ×
 * ~5 KB) while denying enough room to OOM the worker.
 */
export const MAX_DECOMPRESSED_INGEST_BYTES = 10 * 1024 * 1024;

/** Errors the pipe with 413 the moment cumulative output exceeds `maxBytes` — no chunk ever buffered fully in memory. */
function createByteCapStream(maxBytes: number) {
  let bytes = 0;
  return new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      bytes += chunk.byteLength;
      if (bytes > maxBytes) {
        controller.error(new HttpError(413, "Payload too large"));
        return;
      }
      controller.enqueue(chunk);
    },
  });
}

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

/** `pageViews` is ignored — kept for back-compat so old SDK builds don't get bricked. */
export const ingestSchema = z.object({
  sessionId: z.uuid(),
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
 * Returns `unknown` on purpose — caller runs `ingestSchema.parse()` so
 * malformed payloads fail with per-field errors instead of a generic
 * `JSON.parse` SyntaxError.
 */
export async function parseIngestBody(req: Request): Promise<unknown> {
  if (req.headers.get("Content-Encoding") === "gzip") {
    const decoder = new DecompressionStream("gzip");
    const cap = createByteCapStream(MAX_DECOMPRESSED_INGEST_BYTES);
    const decompressed = req.body!.pipeThrough(decoder).pipeThrough(cap);
    const text = await new Response(decompressed).text();
    return JSON.parse(text);
  }
  return req.json();
}
