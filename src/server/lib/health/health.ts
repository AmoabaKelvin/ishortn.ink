import { withTimeout } from "./deep-health";

const DEFAULT_TIMEOUT_MS = 2_000;

/**
 * Public liveness probe for uptime monitors: one database round trip, and a
 * body that says only up or down. Failure details stay out of the response
 * because the endpoint is unauthenticated; /api/health/deep has the detail.
 */
export async function healthCheck(
  ping: () => Promise<void>,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<Response> {
  let ok = true;
  try {
    await withTimeout(ping(), timeoutMs);
  } catch {
    ok = false;
  }
  return Response.json(
    { ok },
    { status: ok ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}
