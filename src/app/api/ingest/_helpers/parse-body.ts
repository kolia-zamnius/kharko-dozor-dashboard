import "server-only";

import { z } from "zod";

import { HttpError } from "@/server/http-error";

/**
 * Zod schemas + body parser for `POST /api/ingest`.
 *
 * @remarks
 * Kept in a sibling file so the route reads as a named-step pipeline
 * rather than 50 lines of validation prelude.
 */

/**
 * Hard cap on the DECOMPRESSED ingest body — guards against gzip-bomb
 * DoS where a small compressed payload expands to gigabytes and exhausts
 * Node heap before Zod validation runs. Vercel caps the compressed body
 * at 4.5 MB; gzip ratio for rrweb event JSON is typically 5-10×, so a
 * ceiling of 10 MB decompressed sits comfortably above realistic SDK
 * batches (500 events × ~5 KB) while denying any attacker enough room
 * to OOM the worker.
 */
export const MAX_DECOMPRESSED_INGEST_BYTES = 10 * 1024 * 1024;

/**
 * Streaming byte counter — errors the pipe with `HttpError(413)` the
 * moment cumulative output exceeds `maxBytes`, so a malicious gzip
 * payload never holds more than a single chunk in memory.
 */
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

/**
 * Full ingest envelope.
 *
 * @remarks
 * `pageViews` is kept for backward compat with old SDK builds — the
 * server ignores it, but rejecting the payload for an extra legacy
 * key would brick customers pinned to old tracker versions.
 */
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
 * Read the request body, transparently decompressing gzip payloads.
 *
 * @remarks
 * The tracker SDK gzips batches above a few KB (5-10× egress savings).
 * Returns `unknown` on purpose — caller runs `ingestSchema.parse()`
 * so malformed payloads fail with per-field errors instead of a
 * generic `"Unexpected token"` from `JSON.parse`.
 *
 * Decompressed output is metered through {@link createByteCapStream};
 * if a pathological payload expands past
 * {@link MAX_DECOMPRESSED_INGEST_BYTES} the pipe errors with
 * `HttpError(413)` before the JSON parser ever runs.
 *
 * @param req - The incoming `POST /api/ingest` request.
 * @returns Parsed JSON body — still unvalidated, pass to `ingestSchema.parse`.
 * @throws {HttpError} 413 when the decompressed body exceeds the cap.
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
