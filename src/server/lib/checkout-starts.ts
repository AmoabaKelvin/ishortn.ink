import { logger } from "@/lib/logger";
import { db } from "@/server/db";
import { checkoutStart } from "@/server/db/schema";

import type { DbClient } from "@/server/lib/user-plan";

const log = logger.child({ component: "checkout-starts" });

export type CheckoutStartInput = typeof checkoutStart.$inferInsert;

/** Logs a checkout handed to the user. Never throws: a failed write must not block the checkout. */
export async function recordCheckoutStart(
  start: CheckoutStartInput,
  dbClient: Pick<DbClient, "insert"> = db,
): Promise<void> {
  try {
    await dbClient.insert(checkoutStart).values(start);
  } catch (err) {
    log.warn({ err, userId: start.userId }, "failed to record checkout start");
  }
}
