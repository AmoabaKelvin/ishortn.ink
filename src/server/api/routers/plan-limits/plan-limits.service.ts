import { recordPlanLimitHit } from "@/server/lib/plan-limit-hits";

import type { WorkspaceTRPCContext } from "../../trpc";
import type { RecordPlanLimitViewInput } from "./plan-limits.input";

/** Logs that a gated screen was shown. Only free personal workspaces see the gates. */
export const recordPlanLimitView = async (
  ctx: WorkspaceTRPCContext,
  input: RecordPlanLimitViewInput,
) => {
  if (ctx.workspace.type !== "personal" || ctx.workspace.plan !== "free") return;
  await recordPlanLimitHit({ userId: ctx.auth.userId, limitKey: input.limitKey, plan: "free" });
};
