import { NextResponse } from "next/server";

import { logger } from "@/lib/logger";
import { cleanupExpiredData } from "@/server/api/routers/cleanup/expired-data-cleanup.service";
import { isInternalRequest } from "@/server/lib/internal-request";

const log = logger.child({ job: "cleanup-expired" });

/**
 * Cron job endpoint to clean up expired data:
 * - Expired team invites (past expiresAt and not accepted)
 * - Invalid custom domains older than 30 days
 *
 * This endpoint requires API key authentication via the CRON_SECRET environment variable.
 * The Worker's scheduled handler sends GET requests with the Authorization header.
 *
 * Schedule: 0 4 * * * (daily at 4 AM UTC) - configured in wrangler.jsonc
 *
 * Environment variable required:
 * - CRON_SECRET: A secure random string used to authenticate cron requests
 *
 * Usage:
 * GET /api/cron/cleanup-expired
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

    const result = await cleanupExpiredData();

    const durationMs = Date.now() - startTime;
    log.info(
      {
        durationMs,
        expiredInvitesDeleted: result.expiredInvitesDeleted,
        invalidDomainsDeleted: result.invalidDomainsDeleted,
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
