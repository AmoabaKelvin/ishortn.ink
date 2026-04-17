import { waitUntil } from "@vercel/functions";

// In production, waitUntil keeps the serverless/edge function alive until the
// promise settles. Locally waitUntil is a no-op, which would drop unhandled
// rejections silently — so we await the promise inline in dev so failures
// surface and can be debugged.
const isLocalhost = process.env.NODE_ENV === "development";

export async function runBackgroundTask<T>(promise: Promise<T>): Promise<T | undefined> {
  if (isLocalhost) return promise;
  waitUntil(promise);
  return undefined;
}
