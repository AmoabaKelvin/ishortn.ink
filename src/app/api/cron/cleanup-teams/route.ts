import { NextResponse } from "next/server";

import { logger } from "@/lib/logger";
import { cleanupDeletedTeams } from "@/server/api/routers/team/team-cleanup.service";
import { isInternalRequest } from "@/server/lib/internal-request";

const log = logger.child({ job: "cleanup-teams" });

/**
 * Cron job endpoint to clean up soft-deleted teams that have passed the grace period.
 *
 * This endpoint requires API key authentication via the CRON_SECRET environment variable.
 * The Worker's scheduled handler sends GET requests with the Authorization header.
 *
 * Schedule: 0 0 * * * (daily at midnight) - configured in wrangler.jsonc
 *
 * Environment variable required:
 * - CRON_SECRET: A secure random string used to authenticate cron requests
 *
 * Usage:
 * GET /api/cron/cleanup-teams
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

    const result = await cleanupDeletedTeams();

    const durationMs = Date.now() - startTime;
    log.info({ durationMs, teamsDeleted: result.teamsDeleted }, "cleanup complete");

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
