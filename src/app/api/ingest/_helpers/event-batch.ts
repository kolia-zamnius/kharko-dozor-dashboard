import "server-only";

import { prisma } from "@/server/db/client";
import type { IngestEvent } from "./parse-body";

// `CompressionStream` is a Node 18+ global — no polyfill needed in the App Router runtime.
async function gzipJson(events: readonly IngestEvent[]): Promise<Buffer> {
  const json = JSON.stringify(events);
  const stream = new Blob([json]).stream().pipeThrough(new CompressionStream("gzip"));
  const arrayBuffer = await new Response(stream).arrayBuffer();
  return Buffer.from(arrayBuffer);
}

export async function insertEventBatch(sessionId: string, events: readonly IngestEvent[]): Promise<void> {
  if (events.length === 0) return;

  let firstTimestamp = events[0]!.timestamp;
  let lastTimestamp = events[0]!.timestamp;
  for (const e of events) {
    if (e.timestamp < firstTimestamp) firstTimestamp = e.timestamp;
    if (e.timestamp > lastTimestamp) lastTimestamp = e.timestamp;
  }

  const data = await gzipJson(events);

  await prisma.eventBatch.create({
    data: {
      sessionId,
      firstTimestamp: BigInt(firstTimestamp),
      lastTimestamp: BigInt(lastTimestamp),
      eventCount: events.length,
      data: data as unknown as Uint8Array<ArrayBuffer>,
    },
  });
}
