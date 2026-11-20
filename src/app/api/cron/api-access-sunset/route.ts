import { NextResponse } from "next/server";

import { logger } from "@/lib/logger";
import { sendApiSunsetEmailsDue } from "@/server/lib/api-access";
import { isInternalRequest } from "@/server/lib/internal-request";

const log = logger.child({ job: "api-access-sunset" });

/**
 * Cron job endpoint that emails owners of API keys on accounts without a paid
 * plan before their keys stop working: a notice when the account's sunset
 * period starts and a reminder 24 hours before its cutoff.
 *
 * Schedule: 10 * * * * (hourly) - configured in wrangler.jsonc
 *
 * Usage:
 * GET /api/cron/api-access-sunset
 * Headers: { "Authorization": "Bearer <CRON_SECRET>" }
 */
export async function GET(request: Request) {
  if (!isInternalRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await sendApiSunsetEmailsDue();
    return NextResponse.json({ success: true, result });
  } catch (error) {
    log.error({ err: error }, "api sunset email job failed");
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
