import { waitUntil } from "@vercel/functions";

import { logger } from "@/lib/logger";

const log = logger.child({ component: "background-task" });

// In production, waitUntil keeps the serverless/edge function alive until the
// promise settles. Locally waitUntil is a no-op, which would drop unhandled
// rejections silently — so we await the promise inline in dev so failures
// surface and can be debugged.
const isLocalhost = process.env.NODE_ENV === "development";

export async function runBackgroundTask<T>(promise: Promise<T>): Promise<T | undefined> {
  if (isLocalhost) return promise;
  // waitUntil does not attach any rejection handler; a rejected promise would
  // become an unhandled rejection in the function's Node runtime. Swallow and
  // log so Vercel records the failure without marking the invocation as failed
  // after the response has already been sent.
  waitUntil(
    promise.catch((err) => {
      log.error({ err }, "background task failed");
    }),
  );
  return undefined;
}
