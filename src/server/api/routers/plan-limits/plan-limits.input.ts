import { z } from "zod";

import { PLAN_LIMIT_VIEW_KEYS } from "@/lib/billing/plan-limits";

export const recordPlanLimitViewInput = z.object({
  limitKey: z.enum(PLAN_LIMIT_VIEW_KEYS),
});

export type RecordPlanLimitViewInput = z.infer<typeof recordPlanLimitViewInput>;
