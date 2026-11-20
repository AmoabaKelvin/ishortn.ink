import { TRPCError } from "@trpc/server";

import type { ZodError } from "zod";

export type ApiErrorCode =
  | "bad_request"
  | "invalid_json"
  | "validation_failed"
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "conflict"
  | "rate_limited"
  | "internal_error";

export type ApiErrorDetail = { path: string; message: string };

/** Every v1 error has the shape `{ error: { code, message, details } }`. */
export function apiError(
  status: number,
  code: ApiErrorCode,
  message: string,
  { details = [], headers }: { details?: ApiErrorDetail[]; headers?: HeadersInit } = {},
): Response {
  return Response.json({ error: { code, message, details } }, { status, headers });
}

export function validationError(error: ZodError): Response {
  return apiError(400, "validation_failed", "Request body is invalid", {
    details: error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })),
  });
}

/** Parses a JSON body, answering a malformed one with a 400 instead of throwing. */
export async function readJsonBody(
  request: Request,
): Promise<{ ok: true; body: unknown } | { ok: false; response: Response }> {
  try {
    return { ok: true, body: await request.json() };
  } catch {
    return {
      ok: false,
      response: apiError(400, "invalid_json", "Request body must be valid JSON"),
    };
  }
}

function trpcErrorResponse(error: TRPCError): Response {
  switch (error.code) {
    case "BAD_REQUEST":
      return apiError(400, "bad_request", error.message);
    case "FORBIDDEN":
      return apiError(403, "forbidden", error.message);
    case "NOT_FOUND":
      return apiError(404, "not_found", error.message);
    case "CONFLICT":
      return apiError(409, "conflict", error.message);
    default:
      return apiError(500, "internal_error", "An unexpected error occurred");
  }
}

/**
 * Maps an error thrown by shared link logic to a response. Those helpers throw
 * TRPCErrors or plain Errors whose messages are user-facing validation errors
 * (alias rules, plan gates), so plain Errors are a 400.
 */
export function errorResponse(cause: unknown): Response {
  if (cause instanceof TRPCError) return trpcErrorResponse(cause);
  if (cause instanceof Error) return apiError(400, "bad_request", cause.message);
  return apiError(400, "bad_request", "An error occurred");
}
