/**
 * Diffs the committed `openapi.snapshot.json` against a contract assembled from
 * the repo's zod validators. The snapshot IS the documented contract — any
 * shape change surfaces as a readable JSON diff in the PR, and the Fumadocs API
 * reference renders straight off it.
 *
 * Deliberate change: `UPDATE_OPENAPI=1 npm run test:contract` rewrites the
 * snapshot in the same run, so the resulting diff lands in the PR for review.
 *
 * OpenAPI 3.1 is a JSON Schema superset, so Zod 4's native `z.toJSONSchema()`
 * handles body/query/response shapes; the manifest below assembles paths,
 * parameters, and status codes by hand. Simpler than zod-to-openapi, no
 * library-version coupling, handles `z.unknown()` natively.
 */

import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";
import { z, type ZodType } from "zod";

import {
  createOrgSchema,
  inviteSchema,
  organizationCreatedSchema,
  organizationInviteCreatedSchema,
  organizationInviteListSchema,
  organizationListSchema,
  organizationMemberListSchema,
  updateInviteSchema,
  updateOrgSchema,
} from "@/api-client/organizations/schemas";
import {
  createProjectSchema,
  deleteProjectSchema,
  projectKeySchema,
  projectListSchema,
  projectSchema,
  updateProjectDisplayNameTraitKeySchema,
  updateProjectSchema,
} from "@/api-client/projects/schemas";
import {
  paginatedSessionsSchema,
  sessionDetailSchema,
  sessionEventsResponseSchema,
  sessionListParamsSchema,
  sessionMarkersResponseSchema,
  sessionsSummarySchema,
} from "@/api-client/sessions/schemas";
import {
  paginatedTrackedUsersSchema,
  trackedUserDetailSchema,
  trackedUsersSummarySchema,
  updateDisplayNameSchema,
  userActivitySchema,
  userListParamsSchema,
  userStatusSchema,
  userTimelineSchema,
} from "@/api-client/tracked-users/schemas";
import {
  userInviteAcceptResponseSchema,
  userInviteDeclineResponseSchema,
  userInviteListSchema,
} from "@/api-client/user-invites/schemas";
import {
  deleteAccountSchema,
  renamePasskeySchema,
  updateLocaleSchema,
  updateProfileSchema,
  userAvatarResponseSchema,
  userProfileSchema,
} from "@/api-client/user/schemas";
import { ingestSchema } from "@/app/api/ingest/_helpers/parse-body";

/**
 * Mirrors of schemas that live inline in route files (not in their feature's
 * `schemas.ts`) — importing the route module would drag in Prisma + Auth.js +
 * the whole server runtime. Drift is unguarded: if a route's inline schema
 * diverges, the docs render the wrong shape but no test fails. Acceptable for
 * the handful of inline bodies; hoist into the feature `schemas.ts` if more
 * appear.
 */
const switchOrgSchema = z.object({
  organizationId: z.string().min(1, "organizationId is required"),
});

const updateMemberRoleSchema = z.object({
  role: z.enum(["OWNER", "ADMIN", "VIEWER"], { message: "Invalid role" }),
});

const cancelSessionSchema = z.object({
  sessionId: z.uuid(),
});

/**
 * Tracked-user sub-routes parse query strings inline via helpers like
 * `parseActivityRange`/`parsePageLimit` rather than a Zod schema, so these
 * schemas exist only for the OpenAPI snapshot.
 */
const userActivityRangeSchema = z.object({
  range: z.enum(["6h", "24h", "7d"]).optional(),
  pageLimit: z.coerce.number().int().min(1).optional(),
});

const userTimelineRangeSchema = z.object({
  range: z.enum(["6h", "24h", "7d"]).optional(),
});

const userSessionsCursorSchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

const cronCleanupSummarySchema = z.object({
  invites: z.number().int().nonnegative(),
  sessions: z.number().int().nonnegative(),
  trackedUsers: z.number().int().nonnegative(),
  organizations: z.number().int().nonnegative(),
});

const here = dirname(fileURLToPath(import.meta.url));
const SNAPSHOT_PATH = resolve(here, "..", "..", "openapi.snapshot.json");

type AuthModel = "session" | "publicKey" | "cron" | "public";

/**
 * Union with bare `ZodType` exists so endpoints opt into examples one at a time
 * — no flag-day rewrite of all 48 manifest entries. Examples are validated
 * against their schema in a dedicated test below (drift fails specifically).
 */
type BodySpec = {
  schema: ZodType;
  example: unknown;
};

interface ResponseSpec {
  description: string;
  schema?: ZodType;
  /** Validated against `schema` when both are set. Both optional — `204` carries neither. */
  example?: unknown;
}

interface PathParam {
  name: string;
  description: string;
  schema?: { type: "string" | "number" | "integer"; format?: string };
}

interface OperationManifest {
  /** FS-style path with `[param]` placeholders — converted to `{param}` for OpenAPI. */
  path: string;
  method: "get" | "post" | "patch" | "put" | "delete" | "options";
  summary: string;
  description?: string;
  auth: AuthModel;
  /** Names must match `[param]` placeholders. */
  pathParams?: PathParam[];
  query?: ZodType;
  body?: ZodType | BodySpec;
  tags?: string[];
  responses: Record<string, ResponseSpec>;
}

function isBodySpec(body: ZodType | BodySpec): body is BodySpec {
  return "schema" in body && "example" in body;
}

function bodySchema(body: ZodType | BodySpec): ZodType {
  return isBodySpec(body) ? body.schema : body;
}

function toOpenApiPath(fsPath: string): string {
  return fsPath.replace(/\[([^\]]+)\]/g, "{$1}");
}

function authHeaders(auth: AuthModel): unknown[] {
  switch (auth) {
    case "session":
      // Auth.js cookie is implicit on same-origin requests — no header to document
      return [];
    case "publicKey":
      return [
        {
          in: "header",
          name: "x-dozor-public-key",
          required: true,
          description: "Project public key (dp_<32hex>) — created in Settings → Organizations → Project.",
          schema: { type: "string" },
        },
      ];
    case "cron":
      return [
        {
          in: "header",
          name: "authorization",
          required: true,
          description: "Bearer token matching `CRON_SECRET`. Vercel injects this on scheduled invocations.",
          schema: { type: "string" },
        },
      ];
    case "public":
      return [];
  }
}

function operationToOpenApi(op: OperationManifest): unknown {
  const parameters: unknown[] = [
    ...authHeaders(op.auth),
    ...(op.pathParams ?? []).map((p) => ({
      in: "path",
      name: p.name,
      required: true,
      description: p.description,
      schema: p.schema ?? { type: "string" },
    })),
  ];

  if (op.query) {
    // Zod object schemas → list of query params. We flatten the top-level
    // object so each property becomes one OpenAPI parameter.
    const querySchema = z.toJSONSchema(op.query) as { properties?: Record<string, unknown>; required?: string[] };
    const properties = querySchema.properties ?? {};
    const required = new Set(querySchema.required ?? []);
    for (const [name, schema] of Object.entries(properties)) {
      parameters.push({
        in: "query",
        name,
        required: required.has(name),
        schema,
      });
    }
  }

  const responses: Record<string, unknown> = {};
  for (const [status, spec] of Object.entries(op.responses)) {
    const entry: Record<string, unknown> = { description: spec.description };
    if (spec.schema) {
      const mediaType: Record<string, unknown> = { schema: z.toJSONSchema(spec.schema) };
      if (spec.example !== undefined) mediaType.example = spec.example;
      entry.content = { "application/json": mediaType };
    }
    responses[status] = entry;
  }

  const requestBody = op.body
    ? (() => {
        const mediaType: Record<string, unknown> = {
          schema: z.toJSONSchema(bodySchema(op.body)),
        };
        if (isBodySpec(op.body)) mediaType.example = op.body.example;
        return {
          required: true,
          content: { "application/json": mediaType },
        };
      })()
    : null;

  const operation: Record<string, unknown> = {
    summary: op.summary,
    ...(op.description ? { description: op.description } : {}),
    ...(op.tags ? { tags: op.tags } : {}),
    ...(parameters.length > 0 ? { parameters } : {}),
    ...(requestBody ? { requestBody } : {}),
    responses,
  };

  return operation;
}

function buildPaths(operations: OperationManifest[]): Record<string, Record<string, unknown>> {
  const paths: Record<string, Record<string, unknown>> = {};
  for (const op of operations) {
    const openApiPath = toOpenApiPath(op.path);
    paths[openApiPath] ??= {};
    paths[openApiPath]![op.method] = operationToOpenApi(op);
  }
  return paths;
}

// ── Manifest ────────────────────────────────────────────────────────────────

const manifest: OperationManifest[] = [
  // ── Public SDK surface ────────────────────────────────────────────────────
  {
    path: "/api/ingest",
    method: "post",
    summary: "Submit a batch of rrweb events from the SDK",
    description:
      "Public-key authenticated. Always returns 204 on success. Accepts gzipped payloads via Content-Encoding: gzip.",
    auth: "publicKey",
    body: {
      schema: ingestSchema,
      example: {
        sessionId: "9b2e1d4c-6a3f-4f8e-9b1d-2c8a4e6f7a90",
        events: [
          {
            type: 4,
            data: { href: "https://your-app.com/checkout", width: 1440, height: 900 },
            timestamp: 1761480000000,
            sliceIndex: 0,
          },
          {
            type: 3,
            data: { source: 1, positions: [{ x: 412, y: 318, id: 17, timeOffset: 0 }] },
            timestamp: 1761480001234,
            sliceIndex: 0,
          },
        ],
        metadata: {
          url: "https://your-app.com/checkout",
          referrer: "https://your-app.com/cart",
          userAgent:
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15",
          screenWidth: 1440,
          screenHeight: 900,
          language: "en-US",
          userIdentity: {
            userId: "usr_abc123",
            traits: { plan: "pro", email: "alex@your-app.com" },
          },
        },
        sliceMarkers: [
          {
            index: 0,
            reason: "init",
            startedAt: 1761480000000,
            url: "https://your-app.com/checkout",
            pathname: "/checkout",
          },
        ],
      },
    },
    tags: ["Ingest"],
    responses: {
      "204": { description: "Batch accepted — no response body" },
      "400": { description: "Malformed batch (zod validation failure)" },
      "401": { description: "Missing or invalid X-Dozor-Public-Key header" },
    },
  },
  {
    path: "/api/ingest",
    method: "options",
    summary: "CORS preflight",
    description:
      "Always returns 204 with CORS headers. No authentication required — browsers send this before the POST.",
    auth: "public",
    tags: ["Ingest"],
    responses: {
      "204": { description: "Preflight OK" },
    },
  },
  // ── Projects ──────────────────────────────────────────────────────────────
  {
    path: "/api/projects",
    method: "get",
    summary: "List projects across the caller's organisations",
    description:
      "Returns every project in every org the caller belongs to. Optional `?organizationId=` narrows to one org. Keys are masked — plaintext only via `GET /api/projects/{id}/key`.",
    auth: "session",
    tags: ["Projects"],
    responses: {
      "200": {
        description: "Project list",
        schema: projectListSchema,
        example: [
          {
            id: "prj_x9y8z7w6",
            name: "Production",
            maskedKey: "dp_a1b2••••••••••••••••••••••••f7e8",
            organizationId: "org_acme",
            sessionCount: 1247,
            lastUsedAt: "2026-04-26T10:29:42.183Z",
            createdAt: "2026-04-12T09:15:00.000Z",
            updatedAt: "2026-04-12T09:15:00.000Z",
          },
          {
            id: "prj_v4u3t2s1",
            name: "Staging",
            maskedKey: "dp_c3d4••••••••••••••••••••••••e9f0",
            organizationId: "org_acme",
            sessionCount: 38,
            lastUsedAt: "2026-04-25T22:11:08.471Z",
            createdAt: "2026-04-12T09:18:30.000Z",
            updatedAt: "2026-04-12T09:18:30.000Z",
          },
        ],
      },
      "401": { description: "Not authenticated" },
    },
  },
  {
    path: "/api/projects",
    method: "post",
    summary: "Create a new project",
    description: "OWNER-only. Mints a fresh API key for the new project.",
    auth: "session",
    body: {
      schema: createProjectSchema,
      example: {
        name: "Production",
        organizationId: "org_acme",
      },
    },
    tags: ["Projects"],
    responses: {
      "201": {
        description: "Project created",
        schema: projectSchema,
        example: {
          id: "prj_x9y8z7w6",
          name: "Production",
          maskedKey: "dp_a1b2••••••••••••••••••••••••f7e8",
          organizationId: "org_acme",
          sessionCount: 0,
          lastUsedAt: null,
          createdAt: "2026-04-26T10:30:00.000Z",
          updatedAt: "2026-04-26T10:30:00.000Z",
        },
      },
      "400": { description: "Body failed validation" },
      "401": { description: "Not authenticated" },
      "403": { description: "Caller is not OWNER of the target organisation" },
    },
  },
  {
    path: "/api/projects/[projectId]",
    method: "patch",
    summary: "Rename a project",
    description: "ADMIN+ — metadata only, not key lifecycle.",
    auth: "session",
    pathParams: [{ name: "projectId", description: "Project id (cuid)" }],
    body: {
      schema: updateProjectSchema,
      example: { name: "Production EU" },
    },
    tags: ["Projects"],
    responses: {
      "204": { description: "Project renamed" },
      "400": { description: "Body failed validation" },
      "401": { description: "Not authenticated" },
      "403": { description: "Caller is not ADMIN+ of the project's organisation" },
      "404": { description: "Project not found" },
    },
  },
  {
    path: "/api/projects/[projectId]",
    method: "delete",
    summary: "Hard-delete a project",
    description:
      "OWNER-only. Cascades sessions → slices → events → tracked users. The deletion is permanent — no soft-delete tombstone.",
    auth: "session",
    pathParams: [{ name: "projectId", description: "Project id (cuid)" }],
    body: {
      schema: deleteProjectSchema,
      example: { confirmation: "delete project" },
    },
    tags: ["Projects"],
    responses: {
      "204": { description: "Project deleted" },
      "400": { description: "Confirmation phrase missing or wrong" },
      "401": { description: "Not authenticated" },
      "403": { description: "Caller is not OWNER" },
      "404": { description: "Project not found" },
    },
  },
  {
    path: "/api/projects/[projectId]/key",
    method: "get",
    summary: "Reveal a project's plaintext API key",
    description:
      "OWNER-only. The single endpoint that returns plaintext key material; called from the dashboard's copy button on click. Sets `Cache-Control: no-store` so no proxy caches the value.",
    auth: "session",
    pathParams: [{ name: "projectId", description: "Project id (cuid)" }],
    tags: ["Projects"],
    responses: {
      "200": {
        description: "Plaintext key",
        schema: projectKeySchema,
        example: { key: "dp_a1b2c3d4e5f6a7b8c9d0e1f2a3b4f7e8" },
      },
      "401": { description: "Not authenticated" },
      "403": { description: "Caller is not OWNER" },
      "404": { description: "Project not found" },
    },
  },
  {
    path: "/api/projects/[projectId]/regenerate-key",
    method: "post",
    summary: "Regenerate a project's API key",
    description:
      "OWNER-only. The old key stops working immediately — no grace window. The response carries the new plaintext key for one-time copy.",
    auth: "session",
    pathParams: [{ name: "projectId", description: "Project id (cuid)" }],
    tags: ["Projects"],
    responses: {
      "200": {
        description: "New plaintext key",
        schema: projectKeySchema,
        example: { key: "dp_5f3a2b1c9d8e7f6a4b2c0d1e3f5a7b9c" },
      },
      "401": { description: "Not authenticated" },
      "403": { description: "Caller is not OWNER" },
      "404": { description: "Project not found" },
    },
  },
  {
    path: "/api/projects/[projectId]/display-name-trait-key",
    method: "patch",
    summary: "Set the project's default display-name trait key",
    description:
      "ADMIN+. The trait key is consulted as step 3 of the 4-step display-name resolution (see `resolveDisplayName`). Pass `null` in `traitKey` to reset.",
    auth: "session",
    pathParams: [{ name: "projectId", description: "Project id (cuid)" }],
    body: {
      schema: updateProjectDisplayNameTraitKeySchema,
      example: { traitKey: "email" },
    },
    tags: ["Projects"],
    responses: {
      "204": { description: "Default trait key updated" },
      "400": { description: "Body failed validation" },
      "401": { description: "Not authenticated" },
      "403": { description: "Caller is not ADMIN+" },
      "404": { description: "Project not found" },
    },
  },
  // ── Organizations ─────────────────────────────────────────────────────────
  {
    path: "/api/organizations",
    method: "get",
    summary: "List the caller's organisations",
    description:
      "Returns every org the caller is a member of, ordered by creation date ascending — Personal Space (always the oldest) surfaces first. Each entry carries the caller's role + the org's member count.",
    auth: "session",
    tags: ["Organizations"],
    responses: {
      "200": {
        description: "Organisation list",
        schema: organizationListSchema,
        example: [
          {
            id: "org_personal",
            name: "Personal Space",
            image: "https://api.dicebear.com/9.x/shapes/svg?seed=personal",
            type: "PERSONAL",
            role: "OWNER",
            membershipId: "mem_personal",
            memberCount: 1,
            createdAt: "2026-01-15T08:00:00.000Z",
          },
          {
            id: "org_acme",
            name: "Acme Inc",
            image: "https://api.dicebear.com/9.x/shapes/svg?seed=acme",
            type: "TEAM",
            role: "OWNER",
            membershipId: "mem_aaaa1111",
            memberCount: 3,
            createdAt: "2026-04-12T09:00:00.000Z",
          },
        ],
      },
      "401": { description: "Not authenticated" },
    },
  },
  {
    path: "/api/organizations",
    method: "post",
    summary: "Create a TEAM organisation",
    description:
      "Creates a TEAM-type org with the caller as its OWNER. Personal Space is auto-provisioned by Auth.js's `createUser` event — this route only mints TEAM orgs.",
    auth: "session",
    body: {
      schema: createOrgSchema,
      example: { name: "Acme Inc" },
    },
    tags: ["Organizations"],
    responses: {
      "201": {
        description: "Organisation created",
        schema: organizationCreatedSchema,
        example: {
          id: "org_acme",
          name: "Acme Inc",
          image: "https://api.dicebear.com/9.x/shapes/svg?seed=acme",
          type: "TEAM",
        },
      },
      "400": { description: "Body failed validation" },
      "401": { description: "Not authenticated" },
    },
  },
  {
    path: "/api/organizations/[orgId]",
    method: "patch",
    summary: "Edit org name and/or avatar",
    description:
      "ADMIN+. `regenerateAvatar: true` rolls the DiceBear seed to a new UUID. Both fields optional; an empty body is a no-op `204`.",
    auth: "session",
    pathParams: [{ name: "orgId", description: "Organisation id (cuid)" }],
    body: {
      schema: updateOrgSchema,
      example: { name: "Acme Labs", regenerateAvatar: true },
    },
    tags: ["Organizations"],
    responses: {
      "204": { description: "Organisation updated (or no-op for empty body)" },
      "400": { description: "Body failed validation" },
      "401": { description: "Not authenticated" },
      "403": { description: "Caller is not ADMIN+" },
      "404": { description: "Organisation not found" },
    },
  },
  {
    path: "/api/organizations/[orgId]",
    method: "delete",
    summary: "Hard-delete a TEAM organisation",
    description:
      "OWNER-only. Cascades projects → sessions → slices → events → tracked users. Personal Space deletion is rejected with `403`. Members whose `activeOrganizationId` pointed here are flipped to their Personal Space first.",
    auth: "session",
    pathParams: [{ name: "orgId", description: "Organisation id (cuid)" }],
    tags: ["Organizations"],
    responses: {
      "204": { description: "Organisation deleted" },
      "401": { description: "Not authenticated" },
      "403": { description: "Caller is not OWNER, or attempting to delete Personal Space" },
      "404": { description: "Organisation not found" },
    },
  },
  {
    path: "/api/organizations/active",
    method: "patch",
    summary: "Switch the caller's active organisation",
    description:
      "Persists `User.activeOrganizationId` (mirrored to JWT). Membership is verified inside the same transaction so the active-org pointer can never flip to an org the caller doesn't belong to.",
    auth: "session",
    body: {
      schema: switchOrgSchema,
      example: { organizationId: "org_acme" },
    },
    tags: ["Organizations"],
    responses: {
      "204": { description: "Active organisation updated" },
      "400": { description: "Body failed validation" },
      "401": { description: "Not authenticated" },
      "403": { description: "Caller is not a member of the target organisation" },
    },
  },
  // ── Members ───────────────────────────────────────────────────────────────
  {
    path: "/api/organizations/[orgId]/members",
    method: "get",
    summary: "List org members",
    description:
      "VIEWER+ — every member sees the full roster. Role-change / remove are gated tighter on the `[memberId]` routes.",
    auth: "session",
    pathParams: [{ name: "orgId", description: "Organisation id (cuid)" }],
    tags: ["Members"],
    responses: {
      "200": {
        description: "Member list",
        schema: organizationMemberListSchema,
        example: [
          {
            id: "mem_aaaa1111",
            role: "OWNER",
            joinedAt: "2026-04-12T09:00:00.000Z",
            user: {
              id: "usr_owner",
              name: "Sam Owner",
              email: "sam@your-company.com",
              image: "https://api.dicebear.com/9.x/shapes/svg?seed=sam",
            },
          },
          {
            id: "mem_bbbb2222",
            role: "ADMIN",
            joinedAt: "2026-04-15T14:22:00.000Z",
            user: {
              id: "usr_admin",
              name: "Jordan Admin",
              email: "jordan@your-company.com",
              image: "https://api.dicebear.com/9.x/shapes/svg?seed=jordan",
            },
          },
          {
            id: "mem_cccc3333",
            role: "VIEWER",
            joinedAt: "2026-04-20T08:45:00.000Z",
            user: {
              id: "usr_viewer",
              name: null,
              email: "support@your-company.com",
              image: "https://api.dicebear.com/9.x/shapes/svg?seed=support",
            },
          },
        ],
      },
      "401": { description: "Not authenticated" },
      "403": { description: "Caller is not a member of the organisation" },
    },
  },
  {
    path: "/api/organizations/[orgId]/members/[memberId]",
    method: "patch",
    summary: "Change a member's role",
    description: "OWNER-only. Multiple OWNERs per org are allowed — single-OWNER lock-out is not enforced by the API.",
    auth: "session",
    pathParams: [
      { name: "orgId", description: "Organisation id (cuid)" },
      { name: "memberId", description: "Membership id (cuid) — NOT the user id" },
    ],
    body: {
      schema: updateMemberRoleSchema,
      example: { role: "ADMIN" },
    },
    tags: ["Members"],
    responses: {
      "204": { description: "Role updated" },
      "400": { description: "Body failed validation" },
      "401": { description: "Not authenticated" },
      "403": { description: "Caller is not OWNER" },
      "404": { description: "Member not found in this organisation" },
    },
  },
  {
    path: "/api/organizations/[orgId]/members/[memberId]",
    method: "delete",
    summary: "Remove a member or self-leave",
    description:
      "Two shapes — self-leave (any role, including last OWNER which triggers ownership transfer to the next-oldest ADMIN) or remove-other (OWNER-only). Personal Space leave is rejected. Sole-member leave is rejected — the route surface answer is to delete the org instead.",
    auth: "session",
    pathParams: [
      { name: "orgId", description: "Organisation id (cuid)" },
      { name: "memberId", description: "Membership id (cuid)" },
    ],
    tags: ["Members"],
    responses: {
      "204": { description: "Member removed / left" },
      "401": { description: "Not authenticated" },
      "403": {
        description: "Caller is not OWNER (when removing other), or attempting to leave Personal Space",
      },
      "404": { description: "Member not found" },
      "409": {
        description: "Sole-member leave — delete the organisation instead",
      },
    },
  },
  // ── Invites (admin-side) ──────────────────────────────────────────────────
  {
    path: "/api/organizations/[orgId]/invites",
    method: "get",
    summary: "List outstanding invites for the org",
    description:
      "OWNER-only — invite lifecycle is governance. Past-TTL rows are filtered out lazily and flipped to `EXPIRED` in the background.",
    auth: "session",
    pathParams: [{ name: "orgId", description: "Organisation id (cuid)" }],
    tags: ["Invites"],
    responses: {
      "200": {
        description: "Pending invite list",
        schema: organizationInviteListSchema,
        example: [
          {
            id: "inv_k4l5m6n7",
            email: "teammate@your-company.com",
            role: "ADMIN",
            expiresAt: "2026-04-29T10:30:00.000Z",
            createdAt: "2026-04-26T10:30:00.000Z",
            invitedBy: { name: "Sam Owner", email: "sam@your-company.com" },
          },
          {
            id: "inv_o8p9q0r1",
            email: "intern@your-company.com",
            role: "VIEWER",
            expiresAt: "2026-04-28T15:12:00.000Z",
            createdAt: "2026-04-25T15:12:00.000Z",
            invitedBy: { name: "Sam Owner", email: "sam@your-company.com" },
          },
        ],
      },
      "401": { description: "Not authenticated" },
      "403": { description: "Caller is not OWNER" },
    },
  },
  {
    path: "/api/organizations/[orgId]/invites",
    method: "post",
    summary: "Send (or refresh) an invite",
    description:
      "OWNER-only. Idempotent refresh-or-create: an existing PENDING invite to the same email is updated in place (TTL reset, role swapped, email re-fired). Email send is fire-and-forget — the invite row exists regardless of SMTP outcome. Per-sender rate-limit (`INVITE_DAILY_LIMIT = 100/day`) returns `429` when capped.",
    auth: "session",
    pathParams: [{ name: "orgId", description: "Organisation id (cuid)" }],
    body: {
      schema: inviteSchema,
      example: {
        email: "teammate@your-company.com",
        role: "ADMIN",
      },
    },
    tags: ["Invites"],
    responses: {
      "200": {
        description: "Invite created or refreshed",
        schema: organizationInviteCreatedSchema,
        example: {
          id: "inv_k4l5m6n7",
          email: "teammate@your-company.com",
          role: "ADMIN",
        },
      },
      "400": { description: "Body failed validation" },
      "401": { description: "Not authenticated" },
      "403": { description: "Caller is not OWNER, or org is Personal Space" },
      "409": { description: "Recipient is already a member — change their role instead" },
      "429": { description: "Daily invite-send cap reached for this sender" },
    },
  },
  {
    path: "/api/organizations/[orgId]/invites/[inviteId]",
    method: "patch",
    summary: "Edit a pending invite",
    description:
      "OWNER-only. Discriminated body — `{ action: 'change-role', role }` updates the role, `{ action: 'extend' }` resets the TTL and re-attributes the inviter to the acting user.",
    auth: "session",
    pathParams: [
      { name: "orgId", description: "Organisation id (cuid)" },
      { name: "inviteId", description: "Invite id (cuid)" },
    ],
    body: {
      schema: updateInviteSchema,
      // 'change-role' branch — the 'extend' branch is described in the route summary.
      example: { action: "change-role", role: "VIEWER" },
    },
    tags: ["Invites"],
    responses: {
      "204": { description: "Invite updated" },
      "400": { description: "Body failed validation" },
      "401": { description: "Not authenticated" },
      "403": { description: "Caller is not OWNER" },
      "404": { description: "Invite not found in this organisation, or not PENDING" },
    },
  },
  {
    path: "/api/organizations/[orgId]/invites/[inviteId]",
    method: "delete",
    summary: "Revoke a pending invite",
    description:
      "OWNER-only. Hard-delete (not a status flip) so the refresh-or-create path on `POST` keeps its idempotency without filtering revoked rows.",
    auth: "session",
    pathParams: [
      { name: "orgId", description: "Organisation id (cuid)" },
      { name: "inviteId", description: "Invite id (cuid)" },
    ],
    tags: ["Invites"],
    responses: {
      "204": { description: "Invite revoked" },
      "401": { description: "Not authenticated" },
      "403": { description: "Caller is not OWNER" },
      "404": { description: "Invite not found in this organisation, or not PENDING" },
    },
  },
  // ── Sessions ──────────────────────────────────────────────────────────────
  {
    path: "/api/sessions",
    method: "get",
    summary: "List sessions, cursor-paginated",
    description:
      "VIEWER+. Scoped to the caller's active org. Filters: `?search=` (matches `externalId`, case-insensitive), `?projectIds=id1,id2`, `?range=` preset (`today` / `7d` / `30d` / `all`), `?sort=date|duration`, `?sortDir=asc|desc`. Display name is resolved server-side via the 4-step chain.",
    auth: "session",
    query: sessionListParamsSchema,
    tags: ["Sessions"],
    responses: {
      "200": {
        description: "Paginated session list",
        schema: paginatedSessionsSchema,
        example: {
          data: [
            {
              id: "ses_p1q2r3s4",
              externalId: "9b2e1d4c-6a3f-4f8e-9b1d-2c8a4e6f7a90",
              projectId: "prj_x9y8z7w6",
              projectName: "Production",
              url: "https://your-app.com/checkout",
              duration: 184_320,
              eventCount: 1247,
              createdAt: "2026-04-26T10:30:00.000Z",
              trackedUserId: "tu_t5u6v7w8",
              userId: "usr_abc123",
              userDisplayName: "alex@your-app.com",
              userTraits: { plan: "pro", email: "alex@your-app.com" },
            },
          ],
          nextCursor: "eyJjcmVhdGVkQXQiOiIyMDI2LTA0LTI2VDEwOjMwOjAwLjAwMFoifQ==",
        },
      },
      "400": { description: "No active organisation set on the caller" },
      "401": { description: "Not authenticated" },
      "403": { description: "Caller is not a member of the active organisation" },
    },
  },
  {
    path: "/api/sessions/[sessionId]",
    method: "get",
    summary: "Full session detail for the replay page",
    description:
      "VIEWER+ of the owning org. Returns metadata + the full marker list (timeline anchors). Event stream is loaded separately via the `/events` sibling endpoint as gzip-compressed batches.",
    auth: "session",
    pathParams: [{ name: "sessionId", description: "Session id (cuid)" }],
    tags: ["Sessions"],
    responses: {
      "200": {
        description: "Session detail",
        schema: sessionDetailSchema,
        example: {
          id: "ses_p1q2r3s4",
          externalId: "9b2e1d4c-6a3f-4f8e-9b1d-2c8a4e6f7a90",
          projectId: "prj_x9y8z7w6",
          projectName: "Production",
          url: "https://your-app.com/checkout",
          userAgent:
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15",
          screenWidth: 1440,
          screenHeight: 900,
          language: "en-US",
          duration: 184_320,
          eventCount: 1247,
          startedAt: "2026-04-26T10:30:00.000Z",
          endedAt: "2026-04-26T10:33:04.320Z",
          createdAt: "2026-04-26T10:30:00.000Z",
          trackedUserId: "tu_t5u6v7w8",
          userId: "usr_abc123",
          userTraits: { plan: "pro", email: "alex@your-app.com" },
          markers: [
            {
              timestamp: 1761480000000,
              kind: "url",
              data: { url: "https://your-app.com/checkout", pathname: "/checkout" },
            },
            {
              timestamp: 1761480078420,
              kind: "url",
              data: { url: "https://your-app.com/checkout/payment", pathname: "/checkout/payment" },
            },
          ],
        },
      },
      "401": { description: "Not authenticated" },
      "403": { description: "Caller is not a VIEWER+ of the owning organisation" },
      "404": { description: "Session not found" },
    },
  },
  {
    path: "/api/sessions/[sessionId]",
    method: "delete",
    summary: "Hard-delete a session",
    description:
      "ADMIN+ (not OWNER) — QA / staging cleanup loops stay unblocked without an owner on call. Cascades event batches and markers.",
    auth: "session",
    pathParams: [{ name: "sessionId", description: "Session id (cuid)" }],
    tags: ["Sessions"],
    responses: {
      "204": { description: "Session deleted" },
      "401": { description: "Not authenticated" },
      "403": { description: "Caller is not ADMIN+ of the owning organisation" },
      "404": { description: "Session not found" },
    },
  },
  {
    path: "/api/sessions/[sessionId]/events",
    method: "get",
    summary: "Stream rrweb events as gzip-compressed batches",
    description:
      "VIEWER+. Returns every `EventBatch` row for the session, ordered by `firstTimestamp`. The client decompresses each `data` (base64 + gzip), concatenates the events, and feeds them to rrweb.Replayer.",
    auth: "session",
    pathParams: [{ name: "sessionId", description: "Session id (cuid)" }],
    tags: ["Sessions"],
    responses: {
      "200": {
        description: "Event-batch list",
        schema: sessionEventsResponseSchema,
        example: {
          batches: [
            {
              id: "ebt_111",
              firstTimestamp: 1761480000000,
              lastTimestamp: 1761480060000,
              eventCount: 250,
              data: "<base64-gzip>",
            },
          ],
          nextCursor: null,
        },
      },
      "401": { description: "Not authenticated" },
      "403": { description: "Caller is not a VIEWER+ of the owning organisation" },
      "404": { description: "Session not found" },
    },
  },
  {
    path: "/api/sessions/[sessionId]/markers",
    method: "get",
    summary: "Typed timeline markers extracted from the event stream",
    description:
      "VIEWER+. Returns marker rows ordered by timestamp. Optional `?kind=` filter (e.g. `url`, `identity`).",
    auth: "session",
    pathParams: [{ name: "sessionId", description: "Session id (cuid)" }],
    tags: ["Sessions"],
    responses: {
      "200": {
        description: "Marker list",
        schema: sessionMarkersResponseSchema,
        example: {
          markers: [
            {
              timestamp: 1761480000000,
              kind: "url",
              data: { url: "https://your-app.com/checkout", pathname: "/checkout" },
            },
          ],
        },
      },
      "401": { description: "Not authenticated" },
      "403": { description: "Caller is not a VIEWER+ of the owning organisation" },
      "404": { description: "Session not found" },
    },
  },
  {
    path: "/api/sessions/summary",
    method: "get",
    summary: "KPI aggregate for the sessions list stats strip",
    description:
      "VIEWER+. Returns four KPIs scoped to the caller's active org: total sessions, total duration, average duration (rounded), active today (created in the last 24 h). Single SQL round-trip via `$queryRaw` with conditional aggregation.",
    auth: "session",
    tags: ["Sessions"],
    responses: {
      "200": {
        description: "Four-KPI aggregate",
        schema: sessionsSummarySchema,
        example: {
          totalSessions: 1247,
          totalDuration: 6_834_120,
          avgDuration: 5481,
          activeToday: 42,
        },
      },
      "400": { description: "No active organisation set on the caller" },
      "401": { description: "Not authenticated" },
      "403": { description: "Caller is not a member of the active organisation" },
    },
  },
  {
    path: "/api/sessions/cancel",
    method: "post",
    summary: "Cancel a session — SDK `stop()` teardown path",
    description:
      "Public-key authenticated. Hard-deletes the session row matching `(projectId, externalId)`. Quiet no-op when no row exists — cancellation can race with the first ingest batch arriving. The `(projectId, externalId)` scoping prevents one project's key from cancelling another project's session.",
    auth: "publicKey",
    body: {
      schema: cancelSessionSchema,
      example: { sessionId: "9b2e1d4c-6a3f-4f8e-9b1d-2c8a4e6f7a90" },
    },
    tags: ["Sessions"],
    responses: {
      "204": { description: "Session cancelled or no-op race" },
      "400": { description: "Body failed validation (sessionId not a UUID)" },
      "401": { description: "Missing or invalid X-Dozor-Public-Key header" },
    },
  },
  {
    path: "/api/sessions/cancel",
    method: "options",
    summary: "CORS preflight",
    description: "Always returns 204 with CORS headers. No authentication required.",
    auth: "public",
    tags: ["Sessions"],
    responses: {
      "204": { description: "Preflight OK" },
    },
  },
  // ── Tracked Users ─────────────────────────────────────────────────────────
  {
    path: "/api/tracked-users",
    method: "get",
    summary: "List tracked users, cursor-paginated",
    description:
      "VIEWER+. Scoped to the caller's active org. Filters: `?search=` (matches `externalId` OR `customName`, case-insensitive), `?projectIds=`, `?statuses=ONLINE,ACTIVE_24H,...`, `?sort=last-seen|sessions|active-time|newest`, `?sortDir=`. Status is derived (not indexable) — when status filter is active the route over-fetches up to 500 rows and applies it in JS.",
    auth: "session",
    query: userListParamsSchema,
    tags: ["Tracked Users"],
    responses: {
      "200": {
        description: "Paginated tracked-user list",
        schema: paginatedTrackedUsersSchema,
        example: {
          data: [
            {
              id: "tu_t5u6v7w8",
              externalId: "usr_abc123",
              displayName: "alex@your-app.com",
              projectId: "prj_x9y8z7w6",
              projectName: "Production",
              traits: { plan: "pro", email: "alex@your-app.com" },
              sessionCount: 14,
              lastEventAt: "2026-04-26T10:33:04.320Z",
              status: "ONLINE",
              activeTime7d: 184_320,
              createdAt: "2026-04-15T11:24:00.000Z",
            },
          ],
          nextCursor: null,
        },
      },
      "400": { description: "No active organisation set on the caller" },
      "401": { description: "Not authenticated" },
      "403": { description: "Caller is not a member of the active organisation" },
    },
  },
  {
    path: "/api/tracked-users/[userId]",
    method: "get",
    summary: "Full tracked-user detail",
    description:
      "VIEWER+. Same shape `loadTrackedUserDetail` produces for the user-detail page Server Component prefetch — `HydrationBoundary` skips the on-mount refetch because the wire format is byte-identical.",
    auth: "session",
    pathParams: [{ name: "userId", description: "TrackedUser id (cuid)" }],
    tags: ["Tracked Users"],
    responses: {
      "200": {
        description: "Tracked-user detail",
        schema: trackedUserDetailSchema,
        example: {
          id: "tu_t5u6v7w8",
          externalId: "usr_abc123",
          displayName: "alex@your-app.com",
          projectId: "prj_x9y8z7w6",
          projectName: "Production",
          traits: { plan: "pro", email: "alex@your-app.com" },
          sessionCount: 14,
          lastEventAt: "2026-04-26T10:33:04.320Z",
          status: "ONLINE",
          activeTime7d: 184_320,
          createdAt: "2026-04-15T11:24:00.000Z",
          customName: null,
          displayNameTraitKey: null,
          projectDisplayNameTraitKey: "email",
        },
      },
      "401": { description: "Not authenticated" },
      "403": { description: "Caller is not a VIEWER+ of the owning organisation" },
      "404": { description: "Tracked user not found" },
    },
  },
  {
    path: "/api/tracked-users/[userId]/display-name",
    method: "patch",
    summary: "Update display-name overrides",
    description:
      "ADMIN+. Body fields `customName` and `traitKey` are independently optional; omitted fields stay unchanged, `null` clears the field (falls back through resolver chain), `string` sets the override (trimmed + validated). Implements steps 1–2 of the 4-step resolver chain.",
    auth: "session",
    pathParams: [{ name: "userId", description: "TrackedUser id (cuid)" }],
    body: {
      schema: updateDisplayNameSchema,
      example: { customName: "Alex (acme rep)" },
    },
    tags: ["Tracked Users"],
    responses: {
      "204": { description: "Display name updated" },
      "400": { description: "Body failed validation (or empty body — at least one field required)" },
      "401": { description: "Not authenticated" },
      "403": { description: "Caller is not ADMIN+ of the owning organisation" },
      "404": { description: "Tracked user not found" },
    },
  },
  {
    path: "/api/tracked-users/[userId]/activity",
    method: "get",
    summary: "Activity dashboard data bundle",
    description:
      "VIEWER+. Three SQL queries in parallel — histogram, page distribution, KPI aggregates — in a rolling window picked from `?range=` (default `24h`). `Cache-Control: no-store` because the histogram advances with each ingest batch.",
    auth: "session",
    pathParams: [{ name: "userId", description: "TrackedUser id (cuid)" }],
    query: userActivityRangeSchema,
    tags: ["Tracked Users"],
    responses: {
      "200": {
        description: "Activity bundle (histogram + pages + KPI summary)",
        schema: userActivitySchema,
        example: {
          range: "24h",
          from: "2026-04-25T10:30:00.000Z",
          to: "2026-04-26T10:30:00.000Z",
          bucketMs: 3_600_000,
          buckets: [
            {
              t: "2026-04-26T09:00:00.000Z",
              total: 412,
              byPage: [
                { pathname: "/checkout", count: 280 },
                { pathname: "/checkout/payment", count: 132 },
              ],
            },
            {
              t: "2026-04-26T10:00:00.000Z",
              total: 835,
              byPage: [
                { pathname: "/checkout/payment", count: 503 },
                { pathname: "/checkout", count: 332 },
              ],
            },
          ],
          pageDistribution: [
            { pathname: "/checkout/payment", duration: 105_900, share: 0.575, visits: 5 },
            { pathname: "/checkout", duration: 78_420, share: 0.425, visits: 3 },
          ],
          summary: {
            sessionCount: 3,
            totalActiveTime: 184_320,
            avgSessionDuration: 61_440,
            totalEvents: 1247,
            uniquePages: 2,
            topPage: "/checkout/payment",
            firstEventAt: "2026-04-26T08:12:00.000Z",
            lastEventAt: "2026-04-26T10:33:04.320Z",
          },
        },
      },
      "401": { description: "Not authenticated" },
      "403": { description: "Caller is not a VIEWER+ of the owning organisation" },
      "404": { description: "Tracked user not found" },
    },
  },
  {
    path: "/api/tracked-users/[userId]/sessions",
    method: "get",
    summary: "Sessions for one tracked user, cursor-paginated",
    description:
      "VIEWER+. Slim shape — no event payload, no trait JSON. Detail fields hydrate per-row via the session detail endpoint on demand. `userDisplayName` is `null` here on purpose (the user-detail page already surfaces the identity above the table).",
    auth: "session",
    pathParams: [{ name: "userId", description: "TrackedUser id (cuid)" }],
    query: userSessionsCursorSchema,
    tags: ["Tracked Users"],
    responses: {
      "200": {
        description: "Paginated session list (sessions list shape)",
        schema: paginatedSessionsSchema,
        example: {
          data: [
            {
              id: "ses_p1q2r3s4",
              externalId: "9b2e1d4c-6a3f-4f8e-9b1d-2c8a4e6f7a90",
              projectId: "prj_x9y8z7w6",
              projectName: "Production",
              url: "https://your-app.com/checkout",
              duration: 184_320,
              eventCount: 1247,
              createdAt: "2026-04-26T10:30:00.000Z",
              trackedUserId: "tu_t5u6v7w8",
              userId: "usr_abc123",
              userDisplayName: null,
              userTraits: null,
            },
          ],
          nextCursor: null,
        },
      },
      "401": { description: "Not authenticated" },
      "403": { description: "Caller is not a VIEWER+ of the owning organisation" },
      "404": { description: "Tracked user not found" },
    },
  },
  {
    path: "/api/tracked-users/[userId]/status",
    method: "get",
    summary: "Online-status heartbeat",
    description:
      "VIEWER+. Lightweight — `MAX(Session.endedAt)` keyed on the indexed `trackedUserId`, no `Event` table scan. Online flag flips when the most recent session ended within `ONLINE_THRESHOLD_MS`. `Cache-Control: no-store` so polling sees fresh values.",
    auth: "session",
    pathParams: [{ name: "userId", description: "TrackedUser id (cuid)" }],
    tags: ["Tracked Users"],
    responses: {
      "200": {
        description: "Online flag + last-event timestamp",
        schema: userStatusSchema,
        example: { online: true, lastEventAt: "2026-04-26T10:33:04.320Z" },
      },
      "401": { description: "Not authenticated" },
      "403": { description: "Caller is not a VIEWER+ of the owning organisation" },
      "404": { description: "Tracked user not found" },
    },
  },
  {
    path: "/api/tracked-users/[userId]/timeline",
    method: "get",
    summary: "Sessions timeline in a rolling window",
    description:
      "VIEWER+. `?range=` matches the activity histogram (`6h` / `24h` / `7d`). Server computes `from = now - windowMs` itself — sending raw ISO from the client would shift the TanStack Query key on every render. Sessions overlap the window if they `startedAt ≤ to AND (endedAt ≥ from OR endedAt IS NULL)`.",
    auth: "session",
    pathParams: [{ name: "userId", description: "TrackedUser id (cuid)" }],
    query: userTimelineRangeSchema,
    tags: ["Tracked Users"],
    responses: {
      "200": {
        description: "Timeline window with sessions + slices",
        schema: userTimelineSchema,
        example: {
          range: "24h",
          from: "2026-04-25T10:30:00.000Z",
          to: "2026-04-26T10:30:00.000Z",
          sessions: [
            {
              id: "ses_p1q2r3s4",
              externalId: "9b2e1d4c-6a3f-4f8e-9b1d-2c8a4e6f7a90",
              startedAt: "2026-04-26T10:30:00.000Z",
              endedAt: "2026-04-26T10:33:04.320Z",
              duration: 184_320,
              url: "https://your-app.com/checkout",
              periods: [
                {
                  url: "https://your-app.com/checkout",
                  pathname: "/checkout",
                  startedAt: "2026-04-26T10:30:00.000Z",
                  endedAt: "2026-04-26T10:31:18.420Z",
                  duration: 78_420,
                },
                {
                  url: "https://your-app.com/checkout/payment",
                  pathname: "/checkout/payment",
                  startedAt: "2026-04-26T10:31:18.420Z",
                  endedAt: "2026-04-26T10:33:04.320Z",
                  duration: 105_900,
                },
              ],
            },
          ],
          pages: ["/checkout", "/checkout/payment"],
        },
      },
      "401": { description: "Not authenticated" },
      "403": { description: "Caller is not a VIEWER+ of the owning organisation" },
      "404": { description: "Tracked user not found" },
    },
  },
  {
    path: "/api/tracked-users/summary",
    method: "get",
    summary: "KPI aggregate for the users list stats strip",
    description:
      "VIEWER+. Four KPIs scoped to the caller's active org: total tracked users, online now, active in last 24 h, new this week. Single SQL round-trip via `$queryRaw` with conditional aggregation + a `LATERAL` join to resolve `MAX(Session.endedAt)` per user.",
    auth: "session",
    tags: ["Tracked Users"],
    responses: {
      "200": {
        description: "Four-KPI aggregate",
        schema: trackedUsersSummarySchema,
        example: { total: 312, onlineNow: 8, active24h: 47, newThisWeek: 21 },
      },
      "400": { description: "No active organisation set on the caller" },
      "401": { description: "Not authenticated" },
      "403": { description: "Caller is not a member of the active organisation" },
    },
  },
  // ── User profile ──────────────────────────────────────────────────────────
  {
    path: "/api/user",
    method: "get",
    summary: "Signed-in user's full profile",
    description:
      "Returns name + email + avatar + linked OAuth accounts + registered passkeys. Powers the settings page's connect / disconnect / rename affordances.",
    auth: "session",
    tags: ["User"],
    responses: {
      "200": {
        description: "User profile",
        schema: userProfileSchema,
        example: {
          id: "usr_owner",
          name: "Sam Owner",
          email: "sam@your-company.com",
          image: "https://api.dicebear.com/9.x/shapes/svg?seed=sam",
          createdAt: "2026-01-15T08:00:00.000Z",
          accounts: [{ provider: "google" }, { provider: "github" }],
          passkeys: [
            {
              credentialID: "AbCdEfGh-1234567890_ijklMNO-pqrsTUV",
              name: "MacBook Touch ID",
              credentialDeviceType: "singleDevice",
              createdAt: "2026-02-03T14:20:00.000Z",
            },
          ],
        },
      },
      "401": { description: "Not authenticated" },
      "404": { description: "User row missing — should never happen post-auth" },
    },
  },
  {
    path: "/api/user",
    method: "patch",
    summary: "Update display name",
    description:
      "Renames the signed-in user. Avatar regeneration has its own endpoint (`POST /api/user/avatar`) — the two actions live in different parts of the profile form.",
    auth: "session",
    body: {
      schema: updateProfileSchema,
      example: { name: "Sam Owner" },
    },
    tags: ["User"],
    responses: {
      "204": { description: "Name updated" },
      "400": { description: "Body failed validation" },
      "401": { description: "Not authenticated" },
    },
  },
  {
    path: "/api/user",
    method: "delete",
    summary: "Hard-delete the signed-in user's account",
    description:
      "Destructive. Confirmation phrase enforced server-side via `deleteAccountSchema` so a misclick can't wipe the account. One transaction: solo-member orgs are deleted outright (cascades invites + full data hierarchy); shared orgs get ownership transfer so an ownerless org is impossible after the cascade. The user row deletes last — cascades accounts, authenticators, memberships.",
    auth: "session",
    body: {
      schema: deleteAccountSchema,
      example: { confirmation: "delete my account" },
    },
    tags: ["User"],
    responses: {
      "204": { description: "Account deleted" },
      "400": { description: "Confirmation phrase missing or wrong" },
      "401": { description: "Not authenticated" },
    },
  },
  {
    path: "/api/user/avatar",
    method: "post",
    summary: "Regenerate the DiceBear avatar seed",
    description:
      "Rolls the avatar seed to a fresh UUID. The `image` URL changes; everything else stays. Returns the new URL so the client updates its avatar slot without a full profile refetch.",
    auth: "session",
    tags: ["User"],
    responses: {
      "200": {
        description: "New avatar URL",
        schema: userAvatarResponseSchema,
        example: {
          image: "https://api.dicebear.com/9.x/shapes/svg?seed=cf3a7b2e9d1c4f5a",
        },
      },
      "401": { description: "Not authenticated" },
    },
  },
  {
    path: "/api/user/locale",
    method: "patch",
    summary: "Update the user's UI locale preference",
    description:
      "Validates against the canonical `LOCALES` tuple. The session refresh + URL prefix swap happen client-side: on `204` the client calls `session.update({})` to force a JWT refresh, then `router.replace(pathname, { locale })` to swap the URL. All three steps are sequenced inside `useUpdateLocaleMutation.onSuccess`.",
    auth: "session",
    body: {
      schema: updateLocaleSchema,
      example: { locale: "uk" },
    },
    tags: ["User"],
    responses: {
      "204": { description: "Locale persisted" },
      "400": { description: "Body failed validation (unknown locale)" },
      "401": { description: "Not authenticated" },
    },
  },
  {
    path: "/api/user/accounts/[provider]",
    method: "delete",
    summary: "Unlink a linked OAuth account",
    description:
      "Only unlinks the local `Account` row — does NOT revoke the provider-side consent (users manage that in Google / GitHub settings). Last-login-method guard runs in a `Serializable` transaction: counts remaining OAuth accounts + passkeys + email-OTP availability AFTER the hypothetical unlink. If zero would remain, returns `409` and the row is preserved — prevents single-click lockout.",
    auth: "session",
    pathParams: [{ name: "provider", description: "OAuth provider name (`google`, `github`, etc.)" }],
    tags: ["User"],
    responses: {
      "204": { description: "Account unlinked" },
      "401": { description: "Not authenticated" },
      "404": { description: "No such linked account for this user" },
      "409": { description: "Cannot unlink — would leave the user with zero sign-in methods" },
    },
  },
  {
    path: "/api/user/passkeys/[credentialId]",
    method: "patch",
    summary: "Rename a registered passkey",
    description:
      "Lets the user distinguish 'MacBook Touch ID' from 'iPhone Face ID' in the authenticators list. Scoped by `(credentialID, userId)` so a credentialID leak can't let another user rename the passkey.",
    auth: "session",
    pathParams: [{ name: "credentialId", description: "WebAuthn credential id (base64url string)" }],
    body: {
      schema: renamePasskeySchema,
      example: { name: "iPhone Face ID" },
    },
    tags: ["User"],
    responses: {
      "204": { description: "Passkey renamed" },
      "400": { description: "Body failed validation" },
      "401": { description: "Not authenticated" },
      "404": { description: "Passkey not found for this user" },
    },
  },
  {
    path: "/api/user/passkeys/[credentialId]",
    method: "delete",
    summary: "Unregister a passkey",
    description:
      "Same `(credentialID, userId)` scoping as rename. The account stays usable via other authenticators (OAuth, OTP) as long as at least one remains — there's no equivalent to the OAuth last-method guard here because passkey removal alone never strands a user.",
    auth: "session",
    pathParams: [{ name: "credentialId", description: "WebAuthn credential id (base64url string)" }],
    tags: ["User"],
    responses: {
      "204": { description: "Passkey unregistered" },
      "401": { description: "Not authenticated" },
      "404": { description: "Passkey not found for this user" },
    },
  },
  {
    path: "/api/user/invites",
    method: "get",
    summary: "List pending invites addressed to the caller's email",
    description:
      "Lazy expiry — past-TTL rows are filtered out and status-flipped to `EXPIRED` in the background. The daily cron hard-deletes past-TTL rows overnight; this keeps the schema clean between runs without an extra scheduled job.",
    auth: "session",
    tags: ["User"],
    responses: {
      "200": {
        description: "Pending invite list",
        schema: userInviteListSchema,
        example: [
          {
            id: "inv_w7x8y9z0",
            role: "ADMIN",
            expiresAt: "2026-04-29T10:30:00.000Z",
            createdAt: "2026-04-26T10:30:00.000Z",
            organization: {
              id: "org_partner",
              name: "Partner Corp",
              image: "https://api.dicebear.com/9.x/shapes/svg?seed=partner",
            },
            invitedBy: { name: "Riley Partner", email: "riley@partner-corp.com" },
          },
        ],
      },
      "401": { description: "Not authenticated" },
    },
  },
  {
    path: "/api/user/invites/[id]/accept",
    method: "post",
    summary: "Claim a pending invite",
    description:
      "Atomic transaction — `Membership` create + invite `status → ACCEPTED` in one round-trip so a crash between writes can't leave a dangling PENDING row for someone who already has membership. Returns the org id + name so the client can navigate to it without a profile refetch.",
    auth: "session",
    pathParams: [{ name: "id", description: "Invite id (cuid)" }],
    tags: ["User"],
    responses: {
      "200": {
        description: "Invite accepted",
        schema: userInviteAcceptResponseSchema,
        example: {
          organizationId: "org_partner",
          organizationName: "Partner Corp",
        },
      },
      "401": { description: "Not authenticated" },
      "403": { description: "Invite email doesn't match the caller's email" },
      "404": { description: "Invite not found, expired, or no longer PENDING" },
    },
  },
  {
    path: "/api/user/invites/[id]/decline",
    method: "post",
    summary: "Decline a pending invite",
    description:
      "Hard-delete (not a `DECLINED` status flip) — declined invites carry no audit value (admin-side list renders only PENDING rows) and the extra enum would buy nothing. If an admin still wants the user, they re-send.",
    auth: "session",
    pathParams: [{ name: "id", description: "Invite id (cuid)" }],
    tags: ["User"],
    responses: {
      "200": {
        description: "Invite declined",
        schema: userInviteDeclineResponseSchema,
        example: { ok: true },
      },
      "401": { description: "Not authenticated" },
      "403": { description: "Invite email doesn't match the caller's email" },
      "404": { description: "Invite not found, expired, or no longer PENDING" },
    },
  },
  // ── Cron ──────────────────────────────────────────────────────────────────
  {
    path: "/api/cron/daily-cleanup",
    method: "get",
    summary: "Nightly database-hygiene sweep (Vercel Cron)",
    description:
      "Bearer-authenticated. Vercel Cron invokes this endpoint per the schedule in `vercel.json` (currently `30 3 * * *` — 03:30 UTC). Four ordered steps in one run: (1) expired invites, (2) sessions older than `SESSION_RETENTION_DAYS = 90`, (3) tracked users with zero remaining sessions, (4) organisations with zero memberships (after nullifying every `User.activeOrganizationId` that referenced them). The `GET` verb is Vercel Cron's contract — destructive-on-GET is ugly but the alternative is a wrapper that fights the platform.",
    auth: "cron",
    tags: ["Cron"],
    responses: {
      "200": {
        description: "Cleanup summary — counters per entity removed",
        schema: cronCleanupSummarySchema,
        example: {
          invites: 4,
          sessions: 132,
          trackedUsers: 17,
          organizations: 2,
        },
      },
      "401": {
        description: "Missing or invalid `Authorization: Bearer $CRON_SECRET`",
      },
    },
  },
];

function buildContract(): unknown {
  return {
    openapi: "3.1.0",
    info: {
      title: "Kharko Dozor REST API",
      version: "1.0.0",
      description:
        "Public SDK ingest endpoint (`/api/ingest`) plus the dashboard's internal API (session-cookie authenticated). Generated from the repo's zod schemas; committed for PR-time diffing.",
    },
    servers: [{ url: "/" }],
    paths: buildPaths(manifest),
  };
}

function serialise(contract: unknown): string {
  return JSON.stringify(contract, null, 2) + "\n";
}

/** Drift sentry: shape a real `@kharko/dozor` SDK call produces. The prod `ingestSchema` must accept it. */
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

describe("REST contract — OpenAPI snapshot", () => {
  it("matches the committed openapi.snapshot.json", async () => {
    const current = serialise(buildContract());

    // Escape hatch for deliberate changes — passes on the same run so the diff lands in the PR.
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
    // Failure = prod schema tightened silently → committed contract advertises
    // a payload the live route rejects. Revert or regenerate the snapshot.
    const result = ingestSchema.safeParse(canonicalPayload);
    expect(result.success).toBe(true);
  });

  it("every manifest example parses through its declared schema", () => {
    // Examples ship into the rendered Fumadocs `<APIPage>` (cURL/JS/Python samples).
    // A stale example would advertise a payload the live route rejects — failure
    // surfaces operation + status + zod issues, pointing at the manifest entry.
    const failures: string[] = [];

    for (const op of manifest) {
      const where = `${op.method.toUpperCase()} ${op.path}`;

      if (op.body && isBodySpec(op.body)) {
        const result = op.body.schema.safeParse(op.body.example);
        if (!result.success) {
          failures.push(`${where} body example: ${JSON.stringify(result.error.issues)}`);
        }
      }

      for (const [status, spec] of Object.entries(op.responses)) {
        if (spec.schema && spec.example !== undefined) {
          const result = spec.schema.safeParse(spec.example);
          if (!result.success) {
            failures.push(`${where} response[${status}] example: ${JSON.stringify(result.error.issues)}`);
          }
        }
      }
    }

    expect(failures, failures.join("\n")).toEqual([]);
  });
});
