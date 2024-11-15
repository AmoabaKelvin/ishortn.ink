import { createTRPCRouter, protectedProcedure } from "../../trpc";

import * as inputs from "./settings.input";
import * as services from "./settings.service";

export const siteSettingsRouter = createTRPCRouter({
  get: protectedProcedure.query(({ ctx }) => {
    return services.getSiteSettings(ctx);
  }),

  update: protectedProcedure.input(inputs.updateSiteSettingsSchema).mutation(({ ctx, input }) => {
    return services.updateSiteSettings(ctx, input);
  }),
});
