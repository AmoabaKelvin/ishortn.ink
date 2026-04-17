export type Level = "debug" | "info" | "warn" | "error";

export type Context = Record<string, unknown>;

export const LEVEL_ORDER: Record<Level, number> = {
  debug: 20,
  info: 30,
  warn: 40,
  error: 50,
};

export function normalize(
  arg1: Context | string,
  arg2?: string,
): { ctx: Context; msg?: string } {
  if (typeof arg1 === "string") {
    return { ctx: {}, msg: arg1 };
  }
  return { ctx: arg1 ?? {}, msg: arg2 };
}
