import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";

import { recordAttributionInput } from "./attribution.input";
import { recordAttribution } from "./attribution.service";

export const attributionRouter = createTRPCRouter({
  record: protectedProcedure.input(recordAttributionInput).mutation(async ({ ctx, input }) => {
    return recordAttribution(ctx, input);
  }),
});
