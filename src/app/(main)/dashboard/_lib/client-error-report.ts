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

/** Sends a report to the Worker logs. Best effort: a failed report must never surface to the user. */
export function sendClientErrorReport(report: ClientErrorReportInput) {
  // keepalive lets the request finish when a skew reload unloads the page right after.
  fetch("/api/client-errors", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(report),
    keepalive: true,
  }).catch(() => {});
}
