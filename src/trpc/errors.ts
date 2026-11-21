import { TRPCClientError } from "@trpc/client";
import { TRPCError } from "@trpc/server";

/**
 * True when a call through the server `api` client failed with NOT_FOUND. That client wraps
 * procedure errors with `TRPCClientError.from`, so the `TRPCError` is on `.cause`; a bare
 * `TRPCError` is accepted too for direct service calls.
 */
export const isNotFoundError = (cause: unknown): boolean => {
  const trpcError = cause instanceof TRPCClientError ? cause.cause : cause;
  return trpcError instanceof TRPCError && trpcError.code === "NOT_FOUND";
};
