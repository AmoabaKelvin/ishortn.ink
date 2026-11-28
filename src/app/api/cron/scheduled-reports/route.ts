import { NextResponse } from "next/server";

import { logger } from "@/lib/logger";
import { isInternalRequest } from "@/server/lib/internal-request";
import { sendScheduledReports } from "@/server/lib/scheduled-reports";

const log = logger.child({ job: "scheduled-reports" });

/**
 * Cron job endpoint for scheduled email reports on links, folders and campaigns: weekly ones for
 * the last Monday-Sunday week, monthly ones for the last calendar month (UTC).
 *
 * Schedule: 10 * * * * (the shared hourly slot) - configured in wrangler.jsonc. Each run sends
 * whatever is due and not yet sent, so reports go out in the first hour of Monday and the 1st and
 * later runs pick up the rest. Sends are idempotent per schedule per period.
 *
 * Usage:
 * GET /api/cron/scheduled-reports[?dryRun=1]
 * Headers: { "Authorization": "Bearer <CRON_SECRET>" }
 * `dryRun` returns the due reports and their contents without sending.
 */
export async function GET(request: Request) {
  if (!isInternalRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dryRun = new URL(request.url).searchParams.get("dryRun") === "1";

  try {
    const result = await sendScheduledReports({ dryRun });
    return NextResponse.json({ success: true, result });
  } catch (error) {
    log.error({ err: error }, "scheduled reports job failed");
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
