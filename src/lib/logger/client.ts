import type { Context, Level } from "./shared";

const isDev = process.env.NODE_ENV !== "production";

// Silently drop debug/info in prod so diagnostics don't leak to end-user
// devtools. Errors and warnings always pass through.
function shouldEmit(level: Level) {
  return isDev || level === "error" || level === "warn";
}

function emit(level: Level, bindings: Context, ctx: Context, msg: string) {
  const merged = { ...bindings, ...ctx };
  const parts: (string | Context)[] = [msg ? `[${level}] ${msg}` : `[${level}]`];
  if (Object.keys(merged).length > 0) parts.push(merged);

  if (level === "error") {
    console.error(...parts);
  } else if (level === "warn") {
    console.warn(...parts);
  } else if (level === "info") {
    console.info(...parts);
  } else {
    console.debug(...parts);
  }
}

function build(bindings: Context) {
  return {
    debug(ctx: Context, msg: string) {
      if (shouldEmit("debug")) emit("debug", bindings, ctx, msg);
    },
    info(ctx: Context, msg: string) {
      if (shouldEmit("info")) emit("info", bindings, ctx, msg);
    },
    warn(ctx: Context, msg: string) {
      if (shouldEmit("warn")) emit("warn", bindings, ctx, msg);
    },
    error(ctx: Context, msg: string) {
      if (shouldEmit("error")) emit("error", bindings, ctx, msg);
    },
    child(extra: Context) {
      return build({ ...bindings, ...extra });
    },
  };
}

export const clientLogger = build({});

export type ClientLogger = typeof clientLogger;
