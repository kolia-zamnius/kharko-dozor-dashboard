/**
 * SDK contract — OpenAPI 3.1 snapshot derived from the zod schema at the
 * public-key boundary.
 *
 * @remarks
 * The committed `openapi.snapshot.json` is the documented contract
 * between this repo and the `@kharko/dozor` npm SDK. Any change to the
 * ingest envelope surfaces as a readable JSON diff in the PR — a
 * reviewer doesn't have to read a stack trace to decide whether a
 * schema rename breaks downstream consumers.
 *
 * Dev workflow:
 *   - Accidental change: test fails, pointing at the exact path that
 *     drifted. Revert the schema OR acknowledge the breaking change in
 *     PR copy + bump the contract explicitly.
 *   - Deliberate change: run `UPDATE_OPENAPI=1 npm run test:contract`
 *     to regenerate the snapshot, commit the JSON alongside the schema
 *     change. The diff is then part of the PR for explicit review.
 *
 * Implementation: OpenAPI 3.1 is a strict superset of JSON Schema, so
 * we lean on Zod 4's native `z.toJSONSchema()` for the body schema
 * and assemble the rest (paths, parameters, responses) as plain
 * objects. Simpler than zod-to-openapi, zero library-version coupling,
 * handles `z.unknown()` natively (emits `true` per JSON Schema spec).
 *
 * @see openapi.snapshot.json — the committed contract.
 * @see src/app/api/ingest/_helpers/parse-body.ts — source zod schema.
 */

import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";
import { z } from "zod";

import { ingestSchema } from "@/app/api/ingest/_helpers/parse-body";

const here = dirname(fileURLToPath(import.meta.url));
const SNAPSHOT_PATH = resolve(here, "..", "..", "openapi.snapshot.json");

function buildContract(): unknown {
  return {
    openapi: "3.1.0",
    info: {
      title: "Kharko Dozor SDK API",
      version: "1.0.0",
      description:
        "Public contract for the @kharko/dozor SDK. Generated from the repo's zod schemas; committed for PR-time diffing.",
    },
    servers: [{ url: "/" }],
    paths: {
      "/api/ingest": {
        post: {
          summary: "Submit a batch of rrweb events from the SDK",
          description:
            "Public-key authenticated. Always returns 204 on success. Accepts gzipped payloads via Content-Encoding: gzip.",
          parameters: [
            {
              in: "header",
              name: "x-dozor-public-key",
              required: true,
              description: "Project public key (dp_<32hex>)",
              schema: { type: "string" },
            },
            {
              in: "header",
              name: "content-encoding",
              required: false,
              description: "Set to 'gzip' when body is compressed",
              schema: { type: "string" },
            },
          ],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: z.toJSONSchema(ingestSchema),
              },
            },
          },
          responses: {
            "204": { description: "Batch accepted — no response body" },
            "400": { description: "Malformed batch (zod validation failure)" },
            "401": { description: "Missing or invalid X-Dozor-Public-Key header" },
          },
        },
        options: {
          summary: "CORS preflight",
          description:
            "Always returns 204 with CORS headers. No authentication required — browsers send this before the POST.",
          responses: {
            "204": { description: "Preflight OK" },
          },
        },
      },
    },
  };
}

function serialise(contract: unknown): string {
  return JSON.stringify(contract, null, 2) + "\n";
}

/**
 * A canonical SDK payload — the shape a real `@kharko/dozor` SDK call
 * produces. Drift-detection: the production `ingestSchema` must accept
 * it, so a silent shape tightening surfaces here immediately.
 */
const canonicalPayload = {
  sessionId: "550e8400-e29b-41d4-a716-446655440000",
  events: [
    { type: 4, data: { href: "https://example.com" }, timestamp: 1_700_000_000_000, sliceIndex: 0 },
    { type: 2, data: { node: {} }, timestamp: 1_700_000_000_050, sliceIndex: 0 },
  ],
  metadata: {
    url: "https://example.com/",
    referrer: "",
    userAgent: "test-agent/1.0",
    screenWidth: 1920,
    screenHeight: 1080,
    language: "en-US",
    userIdentity: { userId: "u-42", traits: { plan: "pro" } },
  },
  sliceMarkers: [
    { index: 0, reason: "init" as const, startedAt: 1_700_000_000_000, url: "https://example.com/", pathname: "/" },
  ],
};

describe("SDK contract — OpenAPI snapshot", () => {
  it("matches the committed openapi.snapshot.json", async () => {
    const current = serialise(buildContract());

    // Escape hatch for deliberate contract changes. Generates or refreshes
    // the snapshot so the test passes on the SAME run — the resulting
    // diff is then part of the PR for reviewer inspection.
    if (process.env.UPDATE_OPENAPI === "1") {
      await writeFile(SNAPSHOT_PATH, current, "utf8");
      return;
    }

    const committed = await readFile(SNAPSHOT_PATH, "utf8").catch(() => null);
    if (committed === null) {
      throw new Error(
        `Missing ${SNAPSHOT_PATH}. First-time setup: run \`UPDATE_OPENAPI=1 npm run test:contract\` to create it.`,
      );
    }

    expect(current).toBe(committed);
  });

  it("drift sanity: canonical payload parses through the production ingestSchema", () => {
    // If this fails, the prod schema tightened silently — the committed
    // contract would then advertise a payload the live route rejects.
    // Either revert the tightening or regenerate the snapshot explicitly.
    const result = ingestSchema.safeParse(canonicalPayload);
    expect(result.success).toBe(true);
  });
});
