import { NextResponse } from "next/server";

import { logger } from "@/lib/logger";
import { isInternalRequest } from "@/server/lib/internal-request";
import { runLinkHealthCheck } from "@/server/lib/link-health";

const log = logger.child({ job: "link-health" });

/**
 * Cron job endpoint for the destination check: fetches the destinations of active links
 * (clicked in the last 30 days on Pro and Ultra, or on a QR code on any plan), records each
 * link's LinkHealth, and emails Pro and Ultra owners about links that failed two checks in a row.
 *
 * Schedule: 40 * * * * (hourly, a few hundred links per run) - configured in wrangler.jsonc.
 * Links are rechecked at most every 20 hours, so each link is checked about once a day and an
 * overlapping or repeated run only picks up links no other run has written.
 *
 * Usage:
 * GET /api/cron/link-health[?dryRun=1]
 * Headers: { "Authorization": "Bearer <CRON_SECRET>" }
 * Manual run: `bun run cron link-health --url https://ishortn.ink [--dry-run]`
 * `dryRun` checks and returns the new states without writing them or sending email.
 */
export async function GET(request: Request) {
  if (!isInternalRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dryRun = new URL(request.url).searchParams.get("dryRun") === "1";

  try {
    const result = await runLinkHealthCheck({ dryRun });
    return NextResponse.json({ success: true, result });
  } catch (error) {
    log.error({ err: error }, "link health job failed");
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
