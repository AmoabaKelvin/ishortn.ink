import { auth } from "@clerk/nextjs/server";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import type { TRPC_ERROR_CODE_KEY } from "@trpc/server/rpc";

import { logger } from "@/lib/logger";
import { appRouter } from "@/server/api/root";
import { createTRPCContext } from "@/server/api/trpc";

import type { NextRequest } from "next/server";

const trpcLogger = logger.child({ component: "trpc" });

// 4xx-equivalent codes — user-driven errors that shouldn't fire alerting
// thresholds. Anything not in this set (INTERNAL_SERVER_ERROR, unmapped) is
// treated as a real server fault and logged at error.
const CLIENT_ERROR_CODES = new Set<TRPC_ERROR_CODE_KEY>([
  "PARSE_ERROR",
  "BAD_REQUEST",
  "UNAUTHORIZED",
  "FORBIDDEN",
  "NOT_FOUND",
  "METHOD_NOT_SUPPORTED",
  "TIMEOUT",
  "CONFLICT",
  "PRECONDITION_FAILED",
  "PAYLOAD_TOO_LARGE",
  "UNPROCESSABLE_CONTENT",
  "TOO_MANY_REQUESTS",
  "CLIENT_CLOSED_REQUEST",
]);

/**
 * This wraps the `createTRPCContext` helper and provides the required context for the tRPC API when
 * handling a HTTP request (e.g. when you make requests from Client Components).
 */
const createContext = async (req: NextRequest) => {
  return createTRPCContext({
    auth: await auth(),
    headers: req.headers,
  });
};
const handler = (req: NextRequest) =>
  fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: () => createContext(req),
    onError: ({ path, error, type }) => {
      // Intentionally omitting `input` — tRPC procedures accept large/PII
      // payloads (feedback screenshots, link images, QR logo base64) that
      // would bloat logs and leak user content on every transient failure.
      const level = CLIENT_ERROR_CODES.has(error.code) ? "warn" : "error";
      trpcLogger[level](
        {
          err: error,
          path: path ?? null,
          type,
          code: error.code,
        },
        "tRPC request failed",
      );
    },
  });

export { handler as GET, handler as POST };
