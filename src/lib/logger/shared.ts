export type Level = "debug" | "info" | "warn" | "error";

export type LogValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | Date
  | Error
  | readonly LogValue[]
  | { readonly [key: string]: LogValue };

export type Context = Record<string, LogValue>;
