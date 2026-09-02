import { NextResponse } from "next/server";

import { logger } from "@/lib/logger";
import { sendDomainConfigurationReminders } from "@/server/api/routers/domains/domain-reminder.service";
import { isInternalRequest } from "@/server/lib/internal-request";

const log = logger.child({ job: "domain-reminders" });

/**
 * Cron job endpoint to send reminder emails for misconfigured domains.
 *
 * This endpoint requires API key authentication via the CRON_SECRET environment variable.
 * The Worker's scheduled handler sends GET requests with the Authorization header.
 *
 * Schedule: 0 9 * * * (daily at 9 AM UTC) - configured in wrangler.jsonc
 *
 * Environment variable required:
 * - CRON_SECRET: A secure random string used to authenticate cron requests
 *
 * Usage:
 * GET /api/cron/domain-reminders
 * Headers: { "Authorization": "Bearer <CRON_SECRET>" }
 */

/**
 * GET - Run the reminder job (the scheduled handler sends GET requests)
 */
export async function GET(request: Request) {
  if (!isInternalRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    log.debug("starting reminder job");
    const startTime = Date.now();

    const result = await sendDomainConfigurationReminders();

    const durationMs = Date.now() - startTime;
    log.info(
      {
        durationMs,
        domainsChecked: result.domainsChecked,
        domainsUpdatedToActive: result.domainsUpdatedToActive,
        remindersSent: result.remindersSent,
      },
      "reminder job complete",
    );

    return NextResponse.json({
      success: true,
      result,
      duration: `${durationMs}ms`,
    });
  } catch (error) {
    log.error({ err: error }, "reminder job failed");
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
