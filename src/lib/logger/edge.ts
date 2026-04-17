import { maskEmail } from "@/lib/utils/mask";

import { LEVEL_ORDER, normalize, type Context, type Level } from "./shared";

function parseLevel(raw: string | undefined): Level | undefined {
  return raw && raw in LEVEL_ORDER ? (raw as Level) : undefined;
}

const MIN_LEVEL: Level =
  parseLevel(process.env.LOG_LEVEL) ??
  (process.env.NODE_ENV === "production" ? "info" : "debug");

function shouldLog(level: Level) {
  return LEVEL_ORDER[level] >= LEVEL_ORDER[MIN_LEVEL];
}

// Mirrors the server pino redact + email-serializer config so Edge logs can't
// leak auth headers / tokens / PII that a caller might carelessly spread into
// ctx (e.g. `{ headers: req.headers }`). Shallow only — matches top-level keys.
const REDACT_KEYS = new Set([
  "authorization",
  "cookie",
  "password",
  "token",
  "apiKey",
  "api_key",
  "secret",
  "accessToken",
  "refreshToken",
  "clientSecret",
]);

const EMAIL_KEYS = new Set([
  "email",
  "toEmail",
  "fromEmail",
  "recipientEmail",
  "userEmail",
]);

function sanitize(obj: Context): Context {
  const out: Context = {};
  for (const key of Object.keys(obj)) {
    const value = obj[key];
    if (REDACT_KEYS.has(key)) {
      out[key] = "[REDACTED]";
    } else if (EMAIL_KEYS.has(key) && typeof value === "string") {
      out[key] = maskEmail(value);
    } else {
      out[key] = value;
    }
  }
  return out;
}

function emit(level: Level, bindings: Context, ctx: Context, msg?: string) {
  if (!shouldLog(level)) return;
  const payload = {
    level,
    time: new Date().toISOString(),
    env: process.env.NODE_ENV,
    runtime: "edge",
    ...sanitize(bindings),
    ...sanitize(ctx),
    ...(msg ? { msg } : {}),
  };
  const line = JSON.stringify(payload);
  if (level === "error") {
    console.error(line);
  } else if (level === "warn") {
    console.warn(line);
  } else {
    console.log(line);
  }
}

function build(bindings: Context) {
  return {
    debug(ctx: Context | string, msg?: string) {
      const n = normalize(ctx, msg);
      emit("debug", bindings, n.ctx, n.msg);
    },
    info(ctx: Context | string, msg?: string) {
      const n = normalize(ctx, msg);
      emit("info", bindings, n.ctx, n.msg);
    },
    warn(ctx: Context | string, msg?: string) {
      const n = normalize(ctx, msg);
      emit("warn", bindings, n.ctx, n.msg);
    },
    error(ctx: Context | string, msg?: string) {
      const n = normalize(ctx, msg);
      emit("error", bindings, n.ctx, n.msg);
    },
    child(extra: Context) {
      return build({ ...bindings, ...extra });
    },
  };
}

export const edgeLogger = build({});

export type EdgeLogger = typeof edgeLogger;
