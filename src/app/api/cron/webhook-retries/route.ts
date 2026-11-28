import { lt } from "drizzle-orm";
import { NextResponse } from "next/server";

import { logger } from "@/lib/logger";
import { db } from "@/server/db";
import { webhookDelivery } from "@/server/db/schema";
import { isInternalRequest } from "@/server/lib/internal-request";
import { webhookDeliveryDeps } from "@/server/lib/webhooks";
import { runDueDeliveries } from "@/server/lib/webhooks/delivery";
import { dbWebhookStore } from "@/server/lib/webhooks/store";

const log = logger.child({ job: "webhook-retries" });

// Older delivery log rows are pruned: the dashboard shows the latest 50 per endpoint.
const DELIVERY_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
const PRUNE_BATCH = 1000;

/**
 * Cron job endpoint that retries failed webhook deliveries whose backoff has elapsed
 * (src/server/lib/webhooks/delivery.ts) and prunes old delivery log rows.
 *
 * Schedule: 5,20,35,50 * * * * (every 15 minutes, shared with the phishing backlog) - configured
 * in wrangler.jsonc
 *
 * Usage:
 * GET /api/cron/webhook-retries
 * Headers: { "Authorization": "Bearer <CRON_SECRET>" }
 */
export async function GET(request: Request) {
  if (!isInternalRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runDueDeliveries(dbWebhookStore(db), webhookDeliveryDeps(db));
    // Well past the 24 h retry window, so no row this deletes is still pending.
    const cutoff = new Date(Date.now() - DELIVERY_RETENTION_MS);
    const [pruned] = await db
      .delete(webhookDelivery)
      .where(lt(webhookDelivery.createdAt, cutoff))
      .limit(PRUNE_BATCH);
    log.info({ ...result, pruned: pruned.affectedRows }, "webhook retries complete");
    return NextResponse.json({ success: true, result: { ...result, pruned: pruned.affectedRows } });
  } catch (error) {
    log.error({ err: error }, "webhook retries job failed");
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
