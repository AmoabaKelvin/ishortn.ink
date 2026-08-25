import { logger } from "@/lib/logger";
import { runAfterResponse } from "@/lib/platform";

const log = logger.child({ component: "background-task" });

// In production, waitUntil keeps the Worker alive until the promise settles.
// In dev we await the promise inline so failures surface and can be debugged.
const isLocalhost = process.env.NODE_ENV === "development";

export async function runBackgroundTask<T>(promise: Promise<T>): Promise<T | undefined> {
  if (isLocalhost) return promise;
  // waitUntil does not attach any rejection handler; a rejected promise would
  // become an unhandled rejection in the Worker. Swallow and log so the failure
  // is recorded without failing the invocation after the response was sent.
  runAfterResponse(
    promise.catch((err) => {
      log.error({ err }, "background task failed");
    }),
  );
  return undefined;
}
