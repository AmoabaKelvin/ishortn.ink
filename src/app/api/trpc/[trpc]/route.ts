import { auth } from "@clerk/nextjs/server";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";

import { logger } from "@/lib/logger";
import { appRouter } from "@/server/api/root";
import { createTRPCContext } from "@/server/api/trpc";

import type { NextRequest } from "next/server";

const trpcLogger = logger.child({ component: "trpc" });

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
      trpcLogger.error(
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
