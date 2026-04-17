import { normalize, type Context, type Level } from "./shared";

const isDev = process.env.NODE_ENV !== "production";

// Silently drop debug/info in prod so diagnostics don't leak to end-user
// devtools. Errors and warnings always pass through.
function shouldEmit(level: Level) {
  return isDev || level === "error" || level === "warn";
}

function emit(level: Level, bindings: Context, ctx: Context, msg?: string) {
  const merged = { ...bindings, ...ctx };
  const parts: unknown[] = [];
  if (msg) parts.push(`[${level}] ${msg}`);
  else parts.push(`[${level}]`);
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
    debug(ctx: Context | string, msg?: string) {
      if (!shouldEmit("debug")) return;
      const n = normalize(ctx, msg);
      emit("debug", bindings, n.ctx, n.msg);
    },
    info(ctx: Context | string, msg?: string) {
      if (!shouldEmit("info")) return;
      const n = normalize(ctx, msg);
      emit("info", bindings, n.ctx, n.msg);
    },
    warn(ctx: Context | string, msg?: string) {
      if (!shouldEmit("warn")) return;
      const n = normalize(ctx, msg);
      emit("warn", bindings, n.ctx, n.msg);
    },
    error(ctx: Context | string, msg?: string) {
      if (!shouldEmit("error")) return;
      const n = normalize(ctx, msg);
      emit("error", bindings, n.ctx, n.msg);
    },
    child(extra: Context) {
      return build({ ...bindings, ...extra });
    },
  };
}

export const clientLogger = build({});

export type ClientLogger = typeof clientLogger;
