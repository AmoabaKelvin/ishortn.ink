import { NextResponse } from "next/server";

import { logger } from "@/lib/logger";
import { isInternalRequest } from "@/server/lib/internal-request";
import { runLinkCreationHealthCheck } from "@/server/lib/link-creation/health-check";

const log = logger.child({ job: "link-creation-health" });

/**
 * Cron job endpoint that alerts the ops Discord webhook when link creation
 * fails server-side for more than 20% of attempts in the last hour, or when
 * new accounts from the last 24 hours have created no links.
 *
 * Schedule: 40 * * * * (hourly) - configured in wrangler.jsonc
 *
 * Usage:
 * GET /api/cron/link-creation-health
 * Headers: { "Authorization": "Bearer <CRON_SECRET>" }
 */
export async function GET(request: Request) {
  if (!isInternalRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runLinkCreationHealthCheck();
    return NextResponse.json({ success: true, result });
  } catch (error) {
    log.error({ err: error }, "link creation health check failed");
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
