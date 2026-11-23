import { NextResponse } from "next/server";

import { logger } from "@/lib/logger";
import { isInternalRequest } from "@/server/lib/internal-request";
import { sendPromoPausedNotices } from "@/server/lib/promo-paused-notice";

const log = logger.child({ job: "promo-paused-notice" });

/**
 * Cron job endpoint for the paused-tracking promo notice: while a promo runs, one email to each
 * Free account whose analytics tracking is paused this month. Does nothing outside a promo.
 *
 * Schedule: 10 * * * * (hourly, shared with api-access-sunset and first-link-nudge) - configured in wrangler.jsonc
 *
 * Usage:
 * GET /api/cron/promo-paused-notice
 * Headers: { "Authorization": "Bearer <CRON_SECRET>" }
 */
export async function GET(request: Request) {
  if (!isInternalRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await sendPromoPausedNotices();
    return NextResponse.json({ success: true, result });
  } catch (error) {
    log.error({ err: error }, "promo paused notice job failed");
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
