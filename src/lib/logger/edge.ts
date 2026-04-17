import { LEVEL_ORDER, normalize, type Context, type Level } from "./shared";

const MIN_LEVEL: Level =
  (process.env.LOG_LEVEL as Level | undefined) ??
  (process.env.NODE_ENV === "production" ? "info" : "debug");

function shouldLog(level: Level) {
  return LEVEL_ORDER[level] >= LEVEL_ORDER[MIN_LEVEL];
}

function emit(level: Level, bindings: Context, ctx: Context, msg?: string) {
  if (!shouldLog(level)) return;
  const payload = {
    level,
    time: new Date().toISOString(),
    env: process.env.NODE_ENV,
    runtime: "edge",
    ...bindings,
    ...ctx,
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
