import { NextResponse } from "next/server";

import { logger } from "@/lib/logger";
import { cleanupAnalyticsData } from "@/server/api/routers/analytics/analytics-cleanup.service";
import { isInternalRequest } from "@/server/lib/internal-request";

const log = logger.child({ job: "cleanup-analytics" });

/**
 * Cron job endpoint to clean up old analytics data based on user subscription plan.
 *
 * Retention policies:
 * - Free users: 30 days
 * - Pro users: 1 year
 * - Ultra users: Unlimited (no cleanup)
 *
 * This endpoint requires API key authentication via the CRON_SECRET environment variable.
 * The Worker's scheduled handler sends GET requests with the Authorization header.
 *
 * Schedule: 0 2 * * 0 (weekly on Sunday at 2 AM UTC) - configured in wrangler.jsonc
 *
 * Environment variable required:
 * - CRON_SECRET: A secure random string used to authenticate cron requests
 *
 * Usage:
 * GET /api/cron/cleanup-analytics
 * Headers: { "Authorization": "Bearer <CRON_SECRET>" }
 */

/**
 * GET - Run the cleanup job (the scheduled handler sends GET requests)
 */
export async function GET(request: Request) {
  if (!isInternalRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    log.debug("starting cleanup");
    const startTime = Date.now();

    const result = await cleanupAnalyticsData();

    const durationMs = Date.now() - startTime;
    log.info(
      {
        durationMs,
        linkVisitsDeleted: result.linkVisitsDeleted,
        uniqueLinkVisitsDeleted: result.uniqueLinkVisitsDeleted,
        dailySummariesCreated: result.dailySummariesCreated,
      },
      "cleanup complete",
    );

    return NextResponse.json({
      success: true,
      result,
      duration: `${durationMs}ms`,
    });
  } catch (error) {
    log.error({ err: error }, "cleanup failed");
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
