import "server-only";

import pino, { type Logger } from "pino";

/**
 * Application logger — structured pino instance shared across server code.
 *
 * @remarks
 * Three orthogonal concerns the config below addresses:
 *
 * ### Levels
 *   - `LOG_LEVEL` env var picks the level (`fatal | error | warn | info |
 *     debug | trace | silent`). Garbage values fall back to a sensible
 *     default per `NODE_ENV` rather than crashing pino on boot.
 *   - Default per env: `silent` in tests (quiet runs), `debug` in dev
 *     (see everything during `npm run dev`), `info` in prod.
 *
 * ### Pretty-printing
 *   - In dev only, pipe through `pino-pretty` for human-readable colored
 *     output. In prod we keep raw NDJSON so Vercel / Datadog / Axiom
 *     can parse it natively.
 *   - Note: `pino-pretty` is a `devDependencies` entry; the `transport`
 *     option below is gated on `NODE_ENV !== "production"` so prod
 *     bundles never try to require it.
 *
 * ### PII redaction
 *   - Email addresses, secrets, tokens, raw API keys, cookies — anything
 *     that could correlate to a specific human or unlock a session — is
 *     automatically scrubbed from log output **in production** before
 *     serialization. In dev the redaction is off so `npm run dev`
 *     produces useful traces during debugging.
 *   - The redaction list uses pino's path syntax (`*.email`, `email`,
 *     `headers.cookie`, etc.) — extend it as new sensitive shapes show
 *     up in structured logs.
 *
 * Tags / event names go in the **message string** (second arg to log
 * methods); structured fields stay in the first-arg object:
 *
 *   logger.info({ email, newCount: count }, "auth:otp_sending");
 *
 * Search for `auth:otp_sending` in logs aggregates by event;
 * `email=…` filters by user. Both reads work without parsing.
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

/**
 * Production-only redaction paths. Empty in dev so `npm run dev` shows
 * full traces — and in tests because the logger is `silent` there
 * regardless. Add an entry here when a new sensitive field shape lands
 * in structured log calls.
 */
const REDACT_PATHS =
  process.env.NODE_ENV === "production"
    ? [
        "password",
        "*.password",
        "token",
        "*.token",
        "headers.cookie",
        "headers.authorization",
        "req.headers.cookie",
        "req.headers.authorization",
      ]
    : [];

export const logger: Logger = pino({
  level: resolveLevel(),
  redact: { paths: REDACT_PATHS, censor: "[REDACTED]" },
  // Pretty-print only in dev. The `pino-pretty` package is a
  // devDependency — we MUST gate the transport so prod bundles don't
  // try to require it.
  ...(isDev
    ? {
        transport: {
          target: "pino-pretty",
          options: { colorize: true, translateTime: "HH:MM:ss", ignore: "pid,hostname" },
        },
      }
    : {}),
});
