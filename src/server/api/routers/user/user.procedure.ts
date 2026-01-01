import { createTRPCRouter, protectedProcedure } from "../../trpc";

import * as inputs from "./user.input";
import * as services from "./user.service";

export const userRouter = createTRPCRouter({
  getProfile: protectedProcedure.query(({ ctx }) => {
    return services.getUserProfile(ctx);
  }),

  updateProfile: protectedProcedure
    .input(inputs.updateUserProfileSchema)
    .mutation(({ ctx, input }) => {
      return services.updateUserProfile(ctx, input);
    }),
});
