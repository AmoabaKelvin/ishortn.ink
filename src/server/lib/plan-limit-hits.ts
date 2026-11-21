import { logger } from "@/lib/logger";
import { db } from "@/server/db";
import { planLimitHit } from "@/server/db/schema";

import type { PlanLimitKey, PlanLimitViewKey } from "@/lib/billing/plan-limits";
import type { Plan } from "@/lib/billing/plans";
import type { DbClient } from "@/server/lib/user-plan";

const log = logger.child({ component: "plan-limit-hits" });

export type PlanLimitHitInput = {
  userId: string;
  limitKey: PlanLimitKey | PlanLimitViewKey;
  plan: Plan;
};

// Hits already written by this isolate, so repeats (a revoked API key retrying
// in a loop) skip the round trip. The unique key is still what guarantees one
// row per day across isolates.
const recorded = new Set<string>();
const MAX_RECORDED = 1000;

/**
 * Logs that a user hit a plan limit, at most once per user, limit and UTC day
 * (the unique key turns repeats into no-ops). Never throws: a failed write must
 * not change the response to the action that was rejected. Callers inside a
 * transaction that is about to roll back must pass the root `db`, not `tx`.
 */
export async function recordPlanLimitHit(
  hit: PlanLimitHitInput,
  dbClient: Pick<DbClient, "insert"> = db,
): Promise<void> {
  const day = new Date().toISOString().slice(0, 10);
  const memoKey = `${hit.userId}:${hit.limitKey}:${day}`;
  if (recorded.has(memoKey)) return;

  try {
    await dbClient
      .insert(planLimitHit)
      .ignore()
      .values({ ...hit, day });
    if (recorded.size >= MAX_RECORDED) recorded.clear();
    recorded.add(memoKey);
  } catch (err) {
    log.warn({ err, limitKey: hit.limitKey }, "failed to record plan limit hit");
  }
}

/** Forgets which hits this isolate has written (tests that delete rows between cases). */
export function clearPlanLimitHitMemo() {
  recorded.clear();
}
