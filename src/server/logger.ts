import "server-only";

import pino, { type Logger } from "pino";

/**
 * Tag-first API: `log.info(tag, data?)` (vs pino-native `pino.info(obj, msg)`). Tag
 * scans easier than free-form messages in dev output. Tag format
 * `domain:entity:action[:state]` — e.g. `org:invite:create:ok`, `auth:otp:cooldown_blocked`.
 *
 * Production redacts `password` / `token` / `key` / `secret` / cookie + auth headers.
 * Email is deliberately NOT redacted — primary correlation field for oncall. Even
 * with the safety net, NEVER pass API-key plaintext, OTP codes, or session cookies
 * into the data object.
 *
 * `rawLogger` is exposed for the rare `child()` / `fatal` / `trace` need.
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

export type LogData = Record<string, unknown>;

type Emit = (tag: string, data?: LogData) => void;

function makeEmit(level: "debug" | "info" | "warn" | "error"): Emit {
  return (tag, data) => {
    if (data) rawLogger[level](data, tag);
    else rawLogger[level](tag);
  };
}

export const log = {
  debug: makeEmit("debug"),
  info: makeEmit("info"),
  warn: makeEmit("warn"),
  error: makeEmit("error"),
} as const;

export { rawLogger };
