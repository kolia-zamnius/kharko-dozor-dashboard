import "server-only";

import { prisma } from "@/server/db/client";
import type { IngestEvent, IngestMetadata } from "./parse-body";

const RRWEB_CUSTOM_TYPE = 5;
const TAG_PREFIX = "dozor:";

type CustomEventData = { tag: string; payload: unknown };

function isDozorMarker(event: IngestEvent): event is IngestEvent & { data: CustomEventData } {
  if (event.type !== RRWEB_CUSTOM_TYPE) return false;
  const data = event.data as { tag?: unknown; payload?: unknown } | null;
  return !!data && typeof data.tag === "string" && data.tag.startsWith(TAG_PREFIX);
}

// Pulls every `dozor:*` custom event out of the batch and persists it as a typed
// Marker row. `kind` is the part after `dozor:` so the table evolves without a
// schema change when new tags are added on the SDK side.
export async function extractAndInsertMarkers(sessionId: string, events: readonly IngestEvent[]): Promise<void> {
  const rows = events.filter(isDozorMarker).map((event) => {
    const data = event.data as CustomEventData;
    return {
      sessionId,
      timestamp: BigInt(event.timestamp),
      kind: data.tag.slice(TAG_PREFIX.length),
      data: (data.payload ?? null) as object,
    };
  });

  if (rows.length === 0) return;

  await prisma.marker.createMany({ data: rows });
}

// On Session creation we synthesise an initial url-marker from `metadata.url` so
// every session has at least one Marker row anchoring its starting pathname.
// Stats queries can then assume "first url-marker = session start" without
// special-casing single-page sessions.
export async function insertInitialUrlMarker(
  sessionId: string,
  startedAt: Date,
  metadata: IngestMetadata,
): Promise<void> {
  if (!metadata?.url) return;

  let pathname = "/";
  try {
    pathname = new URL(metadata.url).pathname;
  } catch {
    /* keep default */
  }

  await prisma.marker.create({
    data: {
      sessionId,
      timestamp: BigInt(startedAt.getTime()),
      kind: "url",
      data: { url: metadata.url, pathname },
    },
  });
}
