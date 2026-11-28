import { z } from "zod";

// Caps keep one report to a single log line of bounded size, whatever the browser sends.
const MESSAGE_MAX = 1000;
const STACK_MAX = 4000;

const clip = (max: number) => z.string().transform((value) => value.slice(0, max));

export const clientErrorReportInput = z.object({
  /** Which boundary caught it: "dashboard" (error.tsx) or "settings:<section>". */
  boundary: clip(64),
  path: clip(512),
  message: clip(MESSAGE_MAX),
  /** Set on errors thrown on the server; the same id is in the server's own log line. */
  digest: clip(64).optional(),
  stack: clip(STACK_MAX).optional(),
  componentStack: clip(STACK_MAX).optional(),
});

export type ClientErrorReportInput = z.input<typeof clientErrorReportInput>;

/** The report a boundary sends for `error`, before it crosses to the server. */
export function buildClientErrorReport(
  boundary: string,
  error: Error & { digest?: string },
  path: string,
  componentStack?: string | null,
): ClientErrorReportInput {
  return {
    boundary,
    path,
    message: error.message || error.name || "Unknown error",
    digest: error.digest || undefined,
    stack: error.stack || undefined,
    componentStack: componentStack || undefined,
  };
}
