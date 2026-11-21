import { createTRPCRouter, workspaceProcedure } from "../../trpc";
import { recordPlanLimitViewInput } from "./plan-limits.input";
import { recordPlanLimitView } from "./plan-limits.service";

export const planLimitsRouter = createTRPCRouter({
  recordView: workspaceProcedure
    .input(recordPlanLimitViewInput)
    .mutation(({ ctx, input }) => recordPlanLimitView(ctx, input)),
});
