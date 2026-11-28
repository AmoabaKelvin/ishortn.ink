import { NextResponse } from "next/server";

import { logger } from "@/lib/logger";
import {
  clearUnneededOverPlanGraces,
  reconcileEntitlements,
  sendDueGraceEmails,
} from "@/server/lib/entitlements/grace";
import { isInternalRequest } from "@/server/lib/internal-request";

const log = logger.child({ job: "entitlements" });

/**
 * Daily entitlements reconcile: syncs paid and failed-payment subscriptions that
 * their provider (Lemon Squeezy or Paddle) has since expired or cancelled, starts
 * and clears plan grace periods from live subscription status and feature usage,
 * catching missed billing webhooks, and sends the grace emails that are due.
 * Idempotent, so it is also safe to call by hand (for example right after a deploy).
 *
 * With `?emails=1` it only clears over-plan graces that no longer apply and
 * sends the grace emails that are due. That runs hourly, so reminders and
 * end-of-grace emails go out within an hour of when they are due instead of
 * waiting for the next daily run.
 *
 * Schedule: 0 5 * * * (reconcile, daily at 5 AM UTC) and 25 * * * * (emails) -
 * configured in wrangler.jsonc
 *
 * Usage:
 * GET /api/cron/entitlements[?emails=1]
 * Headers: { "Authorization": "Bearer <CRON_SECRET>" }
 */
export async function GET(request: Request) {
  if (!isInternalRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const startTime = Date.now();
    const emailsOnly = new URL(request.url).searchParams.get("emails") === "1";
    const result = emailsOnly
      ? {
          overPlanCleared: await clearUnneededOverPlanGraces(),
          emailsSent: await sendDueGraceEmails({}),
        }
      : await reconcileEntitlements();
    const durationMs = Date.now() - startTime;
    log.info({ durationMs, ...result }, "entitlements reconcile complete");

    return NextResponse.json({ success: true, result, duration: `${durationMs}ms` });
  } catch (error) {
    log.error({ err: error }, "entitlements reconcile failed");
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
