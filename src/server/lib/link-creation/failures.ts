import { TRPCError } from "@trpc/server";
import { getHTTPStatusCodeFromError } from "@trpc/server/http";
import { z } from "zod";

import { logger } from "@/lib/logger";
import { linkCreationFailure } from "@/server/db/schema";

import type { db as Database } from "@/server/db";

const log = logger.child({ component: "link-creation" });

export type LinkCreationSource = "dashboard" | "bulk" | "api" | "extension";
export type LinkCreationStep = "validation" | "safety" | "metadata" | "db";

/** Mutable cursor a create path advances so a failure reports the step it died in. */
export type LinkCreationAttempt = { step: LinkCreationStep };

export type LinkCreationFailure = {
  step: LinkCreationStep;
  code: string;
  serverError: boolean;
};

const ERROR_CODE_PATTERN = /^[A-Z][A-Z0-9_]{0,63}$/;

// Thrown values are untyped; read only the fields that identify the failure.
// `.catch` keeps an unexpected field type (DOMException's numeric `code`) from
// discarding the rest.
const thrownSchema = z.object({
  name: z.string().optional().catch(undefined),
  code: z.string().optional().catch(undefined),
  cause: z.unknown().optional(),
});

// Drizzle wraps driver errors (mysql2 `ER_*`, socket `E*` codes) in `cause`.
function driverErrorCode(cause: unknown): string | null {
  let current = cause;
  for (let depth = 0; depth < 3; depth++) {
    const parsed = thrownSchema.safeParse(current);
    if (!parsed.success) return null;
    const { code } = parsed.data;
    if (code && ERROR_CODE_PATTERN.test(code)) return code;
    current = parsed.data.cause;
  }
  return null;
}

/**
 * Turns a thrown error into a stable code. User-facing rejections are
 * TRPCErrors with a 4xx status; anything else (driver errors, timeouts,
 * programming errors) is a server-side failure.
 */
export function classifyLinkCreationError(
  step: LinkCreationStep,
  cause: unknown,
): LinkCreationFailure {
  if (cause instanceof TRPCError) {
    return { step, code: cause.code, serverError: getHTTPStatusCodeFromError(cause) >= 500 };
  }
  // AbortSignal.timeout rejects with a DOMException, which is not an Error subclass everywhere.
  const parsed = thrownSchema.safeParse(cause);
  const name = parsed.success ? parsed.data.name : undefined;
  if (name === "TimeoutError" || name === "AbortError") {
    return { step, code: "TIMEOUT", serverError: true };
  }
  return { step, code: driverErrorCode(cause) ?? "INTERNAL_SERVER_ERROR", serverError: true };
}

/**
 * Logs failed link creations and stores them for the link-creation-health
 * cron. Never throws: recording must not replace the error the caller is
 * about to surface. Deliberately carries no destination URL or user email.
 */
export async function recordLinkCreationFailures(
  db: typeof Database,
  source: LinkCreationSource,
  userId: string | null,
  failures: LinkCreationFailure[],
): Promise<void> {
  if (failures.length === 0) return;
  for (const failure of failures) {
    const level = failure.serverError ? "error" : "info";
    log[level]({ source, userId, ...failure }, "link creation failed");
  }
  try {
    // The table's `source` enum predates the extension; widening it is a column MODIFY, so
    // extension failures are stored with the API's (the log line above keeps the real source).
    const storedSource = source === "extension" ? "api" : source;
    await db
      .insert(linkCreationFailure)
      .values(failures.map((f) => ({ source: storedSource, ...f })));
  } catch (error) {
    log.error({ err: error, source }, "failed to record link creation failure");
  }
}

/**
 * Runs one link creation and records it if it throws. `run` moves
 * `attempt.step` forward as it passes each stage; the original error is
 * rethrown unchanged.
 */
export async function trackLinkCreation<T>(
  db: typeof Database,
  source: LinkCreationSource,
  userId: string | null,
  run: (attempt: LinkCreationAttempt) => Promise<T>,
): Promise<T> {
  const attempt: LinkCreationAttempt = { step: "validation" };
  try {
    return await run(attempt);
  } catch (error) {
    await recordLinkCreationFailures(db, source, userId, [
      classifyLinkCreationError(attempt.step, error),
    ]);
    throw error;
  }
}
