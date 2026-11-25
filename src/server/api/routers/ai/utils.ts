import { APICallError, RetryError } from "ai";

export const ALIAS_SUGGESTIONS_UNAVAILABLE =
  "Alias suggestions are unavailable right now. You can type your own alias.";

export type AiErrorLogFields = {
  errorName: string;
  statusCode?: number;
  attempts?: number;
};

/**
 * Log fields for a failed model call. Provider messages and response bodies
 * stay out of logs and responses: they can carry account details (quota,
 * billing) that users misread as their own plan.
 */
export function aiErrorLogFields(cause: unknown): AiErrorLogFields {
  // The SDK retries transient failures and wraps the last one.
  if (RetryError.isInstance(cause)) {
    return { ...aiErrorLogFields(cause.lastError), attempts: cause.errors.length };
  }
  if (APICallError.isInstance(cause)) {
    return { errorName: cause.name, statusCode: cause.statusCode };
  }
  return { errorName: cause instanceof Error ? cause.name : "UnknownError" };
}
