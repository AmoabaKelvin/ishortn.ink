import { NextResponse } from "next/server";

import { logger } from "@/lib/logger";
import { isInternalRequest } from "@/server/lib/internal-request";
import { runPhishingRescan } from "@/server/lib/phishing/rescan";

const log = logger.child({ job: "phishing-rescan" });

/**
 * Cron job endpoint that re-scans live links against public phishing feeds (Phishing.Database,
 * OpenPhish, URLhaus when URLHAUS_AUTH_KEY is set) and Google Safe Browsing, then auto-blocks
 * confirmed matches and flags the rest for review in /dashboard/admin/flagged. The backlog runs
 * also fetch the destination pages of new links again (new free accounts, and pages the creation
 * check couldn't verify) about 30 minutes and 24 hours after creation.
 *
 * This endpoint requires API key authentication via the CRON_SECRET environment variable.
 * The Worker's scheduled handler sends GET requests with the Authorization header.
 *
 * Schedule: 30 *\/6 * * * (every 6 hours) for the full scan, and 5,20,35,50 * * * * for the
 * backlog of blocks held back by the per-run cap - configured in wrangler.jsonc
 *
 * Usage:
 * GET /api/cron/phishing-rescan             run and apply blocks/flags
 * GET /api/cron/phishing-rescan?backlog=1   block the held-back backlog and re-check new links'
 *                                           content, no feed scan
 * GET /api/cron/phishing-rescan?dryRun=1    report the decisions without writing anything
 * Headers: { "Authorization": "Bearer <CRON_SECRET>" }
 * Manual run: `bun run cron phishing-rescan [--url https://ishortn.ink] [--dry-run] [--backlog]`
 */
export async function GET(request: Request) {
  if (!isInternalRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const params = new URL(request.url).searchParams;
  const dryRun = params.get("dryRun") === "1";
  const backlogOnly = params.get("backlog") === "1";

  try {
    const startTime = Date.now();
    const result = await runPhishingRescan({ dryRun, backlogOnly });
    const durationMs = Date.now() - startTime;
    log.info({ durationMs, dryRun, backlogOnly }, "rescan complete");

    return NextResponse.json({
      success: true,
      result,
      duration: `${durationMs}ms`,
    });
  } catch (error) {
    log.error({ err: error }, "rescan failed");
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
