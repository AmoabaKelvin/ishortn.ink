import { NextResponse } from "next/server";

import { env } from "@/env.mjs";
import { logger } from "@/lib/logger";
import { isInternalRequest } from "@/server/lib/internal-request";
import { sendWeeklySummaries, summaryWeek, summaryWeekStarting } from "@/server/lib/weekly-summary";

const log = logger.child({ job: "weekly-summary" });

/**
 * Cron job endpoint for the weekly click summary email (last Monday-Sunday week, UTC).
 *
 * Schedule: 0 9-17 * * MON - configured in wrangler.jsonc. The first run sends up to its cap;
 * the hourly runs after it pick up the rest and retry rejected sends. Sends are idempotent per
 * account per week.
 *
 * Usage:
 * GET /api/cron/weekly-summary[?week=YYYY-MM-DD][&dryRun=1]
 * Headers: { "Authorization": "Bearer <CRON_SECRET>" }
 * `week` is the Monday the summarised week starts on; `dryRun` returns the recipients and
 * contents without sending.
 */
export async function GET(request: Request) {
  if (!isInternalRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const params = new URL(request.url).searchParams;
  const weekParam = params.get("week");
  const week = weekParam ? summaryWeekStarting(weekParam) : summaryWeek(new Date());
  if (!week) {
    return NextResponse.json({ error: "week must be a Monday as YYYY-MM-DD" }, { status: 400 });
  }
  const dryRun = params.get("dryRun") === "1";

  // Lifecycle email never goes out from the transactional sender.
  if (!dryRun && !env.EMAIL_FROM_LIFECYCLE) {
    log.warn("weekly summary skipped: EMAIL_FROM_LIFECYCLE is not set");
    return NextResponse.json({ success: true, result: { skipped: "sender not configured" } });
  }

  try {
    const result = await sendWeeklySummaries({ week, dryRun });
    return NextResponse.json({ success: true, result });
  } catch (error) {
    log.error({ err: error }, "weekly summary job failed");
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
