import { createTRPCRouter, protectedProcedure } from "../../trpc";
import * as inputs from "./token.input";
import * as services from "./token.service";

export const tokenRouter = createTRPCRouter({
  list: protectedProcedure.query(({ ctx }) => {
    return services.getTokens(ctx);
  }),

  create: protectedProcedure.input(inputs.createTokenSchema).mutation(({ ctx, input }) => {
    return services.createToken(ctx, input);
  }),

  delete: protectedProcedure.input(inputs.deleteTokenSchema).mutation(({ ctx, input }) => {
    return services.deleteToken(ctx, input);
  }),
});
