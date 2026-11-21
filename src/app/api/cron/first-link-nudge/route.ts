import { NextResponse } from "next/server";

import { logger } from "@/lib/logger";
import { sendFirstLinkNudges } from "@/server/lib/first-link-nudge";
import { isInternalRequest } from "@/server/lib/internal-request";

const log = logger.child({ job: "first-link-nudge" });

/**
 * Cron job endpoint for the first-link nudge: one email to accounts that
 * signed up 24 to 72 hours ago and haven't created a link yet.
 *
 * Schedule: 10 * * * * (hourly, shared with api-access-sunset) - configured in wrangler.jsonc
 *
 * Usage:
 * GET /api/cron/first-link-nudge
 * Headers: { "Authorization": "Bearer <CRON_SECRET>" }
 */
export async function GET(request: Request) {
  if (!isInternalRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await sendFirstLinkNudges();
    return NextResponse.json({ success: true, result });
  } catch (error) {
    log.error({ err: error }, "first link nudge job failed");
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
