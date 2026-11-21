"use client";

import { useRecordPlanLimitView } from "@/lib/hooks/use-record-plan-limit-view";

import type { PlanLimitViewKey } from "@/lib/billing/plan-limits";

/** Logs a gated screen from a server component; renders nothing. */
export function RecordPlanLimitView({ limitKey }: { limitKey: PlanLimitViewKey }) {
  useRecordPlanLimitView(limitKey, true);
  return null;
}
