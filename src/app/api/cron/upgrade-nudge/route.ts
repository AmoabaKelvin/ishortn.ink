import { NextResponse } from "next/server";

import { env } from "@/env.mjs";
import { logger } from "@/lib/logger";
import { isInternalRequest } from "@/server/lib/internal-request";
import { sendUpgradeNudges } from "@/server/lib/upgrade-nudge";

const log = logger.child({ job: "upgrade-nudge" });

/**
 * Cron job endpoint for the upgrade nudge: one email offering Pro to Free accounts that are 4 to
 * 10 days old and actively using iShortn.
 *
 * Schedule: 10 * * * * (hourly, shared with api-access-sunset, first-link-nudge and
 * promo-paused-notice) - configured in wrangler.jsonc
 *
 * Usage:
 * GET /api/cron/upgrade-nudge[?dryRun=1]
 * Headers: { "Authorization": "Bearer <CRON_SECRET>" }
 * `dryRun` returns the recipients and email props without claiming or sending.
 */
export async function GET(request: Request) {
  if (!isInternalRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dryRun = new URL(request.url).searchParams.get("dryRun") === "1";

  // Lifecycle email never goes out from the transactional sender.
  if (!dryRun && !env.EMAIL_FROM_LIFECYCLE) {
    log.warn("upgrade nudge skipped: EMAIL_FROM_LIFECYCLE is not set");
    return NextResponse.json({ success: true, result: { skipped: "sender not configured" } });
  }

  try {
    const result = await sendUpgradeNudges({ dryRun });
    return NextResponse.json({ success: true, result });
  } catch (error) {
    log.error({ err: error }, "upgrade nudge job failed");
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
