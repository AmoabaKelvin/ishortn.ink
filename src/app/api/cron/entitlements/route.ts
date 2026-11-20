import { NextResponse } from "next/server";

import { logger } from "@/lib/logger";
import { reconcileEntitlements } from "@/server/lib/entitlements/grace";
import { isInternalRequest } from "@/server/lib/internal-request";

const log = logger.child({ job: "entitlements" });

/**
 * Daily entitlements reconcile: starts and clears plan grace periods from live
 * subscription status and feature usage, catching missed billing webhooks, and
 * sends the grace emails that are due. Idempotent, so it is also safe to call
 * by hand (for example right after a deploy).
 *
 * Schedule: 0 5 * * * (daily at 5 AM UTC) - configured in wrangler.jsonc
 *
 * Usage:
 * GET /api/cron/entitlements
 * Headers: { "Authorization": "Bearer <CRON_SECRET>" }
 */
export async function GET(request: Request) {
  if (!isInternalRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const startTime = Date.now();
    const result = await reconcileEntitlements();
    const durationMs = Date.now() - startTime;
    log.info({ durationMs, ...result }, "entitlements reconcile complete");

    return NextResponse.json({ success: true, result, duration: `${durationMs}ms` });
  } catch (error) {
    log.error({ err: error }, "entitlements reconcile failed");
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
