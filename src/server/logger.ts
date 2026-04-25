import "server-only";

import pino, { type Logger } from "pino";

/**
 * Application logger — `log.info(tag, data?)` API over a pino instance.
 *
 * @remarks
 * The shape is deliberately swapped vs pino-native (`pino.info(obj, msg)`):
 * in our code the **event tag** comes first because that is what the
 * reader scans for in a wall of dev-mode output. The data object follows
 * and is merged into pino's structured fields under the hood.
 *
 *   log.info("org:invite:create:ok", { inviteId, email, role, byUserId });
 *
 * ### Tag convention — `domain:entity:action[:state]`
 *
 * The tag answers two questions in one glance:
 * 1. **Which API?** — `org:invite:create`, `project:key:regenerate`
 * 2. **What is it doing right now?** — `:start`, `:ok`, `:rate_limited`,
 *    `:not_found`, `:refresh_in_place`, `:failed`
 *
 * Use lowercase + underscores inside segments, `:` between segments.
 * Examples: `auth:otp:cooldown_blocked`, `org:member:role_change`,
 * `cron:cleanup:summary`, `ingest:batch:received`.
 *
 * ### Data convention — flat, max one nested object
 *
 * Top-level keys stay primitive (`userId`, `orgId`, `email`, `role`,
 * `status`). At most ONE nested object, used for true aggregates only —
 * e.g. `summary: { invites: 3, sessions: 1 }` for a cron tally. This
 * keeps `pino-pretty` output readable and dodges `[object Object]`
 * surprises in any consumer that still uses `console`-style printing.
 *
 * Always include actor + target where both apply: `byUserId` (who did it)
 * and the entity ID being acted on (`orgId`, `projectId`, `inviteId`).
 *
 * ### Level guidance
 *
 *   - `debug` — verbose dev traces (validation issues, branch decisions);
 *     stripped in prod by default (`LOG_LEVEL=info`)
 *   - `info`  — normal business events (created, updated, succeeded)
 *   - `warn`  — anomalies that are NOT errors (rate-limit hit, fallback
 *     fired, expired sweep removed N rows)
 *   - `error` — genuine bugs / 5xx-class failures only
 *
 * ### PII redaction
 *
 * Production-only `redact` paths scrub `email` / `password` / `token` /
 * `key` / `secret` / cookie / auth headers before serialization. Dev runs
 * print full traces. Tests are `silent`. Even with the safety net,
 * **never log API-key plaintext, OTP codes, or session cookies** — keep
 * those out of the data object in the first place.
 *
 * ### Escape hatch
 *
 * `rawLogger` exposes the underlying pino instance for the rare case
 * something needs `child()`, `fatal`, or `trace`. Default to `log`.
 */

type ValidLevel = "fatal" | "error" | "warn" | "info" | "debug" | "trace" | "silent";

const VALID_LEVELS: readonly ValidLevel[] = ["fatal", "error", "warn", "info", "debug", "trace", "silent"];

function resolveLevel(): ValidLevel {
  const raw = process.env.LOG_LEVEL?.toLowerCase();
  if (raw && (VALID_LEVELS as readonly string[]).includes(raw)) {
    return raw as ValidLevel;
  }
  if (process.env.NODE_ENV === "test") return "silent";
  if (process.env.NODE_ENV === "production") return "info";
  return "debug";
}

const isDev = process.env.NODE_ENV === "development";

const REDACT_PATHS =
  process.env.NODE_ENV === "production"
    ? [
        "password",
        "*.password",
        "token",
        "*.token",
        "key",
        "*.key",
        "secret",
        "*.secret",
        "headers.cookie",
        "headers.authorization",
        "req.headers.cookie",
        "req.headers.authorization",
      ]
    : [];

const rawLogger: Logger = pino({
  level: resolveLevel(),
  redact: { paths: REDACT_PATHS, censor: "[REDACTED]" },
  ...(isDev
    ? {
        transport: {
          target: "pino-pretty",
          options: { colorize: true, translateTime: "HH:MM:ss", ignore: "pid,hostname" },
        },
      }
    : {}),
});

/**
 * Structured payload for a log event. Flat by convention; one nested
 * object allowed for aggregates. The `unknown` value type is deliberate
 * — callers pass through arbitrary error objects, IDs, numbers, etc.
 */
export type LogData = Record<string, unknown>;

type Emit = (tag: string, data?: LogData) => void;

function makeEmit(level: "debug" | "info" | "warn" | "error"): Emit {
  return (tag, data) => {
    if (data) rawLogger[level](data, tag);
    else rawLogger[level](tag);
  };
}

/**
 * Primary logging entry point. Always prefer this over `rawLogger`,
 * `console.log`, or ad-hoc string concat.
 *
 * @example
 * log.info("org:create:ok", { orgId: org.id, name: org.name, byUserId: user.id });
 * log.warn("auth:otp:rate_limited", { email });
 * log.error("invite:email:delivery_failed", { err, email });
 */
export const log = {
  debug: makeEmit("debug"),
  info: makeEmit("info"),
  warn: makeEmit("warn"),
  error: makeEmit("error"),
} as const;

export { rawLogger };
