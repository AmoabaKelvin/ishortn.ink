import { contentWriteProcedure, createTRPCRouter, workspaceProcedure } from "../../trpc";
import { getStatsShareInput, resetStatsShareInput, setStatsShareInput } from "./stats-share.input";
import { getStatsShare, resetStatsShare, setStatsShare } from "./stats-share.service";

export const statsShareRouter = createTRPCRouter({
  get: workspaceProcedure.input(getStatsShareInput).query(({ ctx, input }) => {
    return getStatsShare(ctx, input);
  }),

  set: contentWriteProcedure.input(setStatsShareInput).mutation(({ ctx, input }) => {
    return setStatsShare(ctx, input);
  }),

  reset: contentWriteProcedure.input(resetStatsShareInput).mutation(({ ctx, input }) => {
    return resetStatsShare(ctx, input);
  }),
});
