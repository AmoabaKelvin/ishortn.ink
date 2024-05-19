import { z } from "zod";

import { createTRPCRouter, protectedProcedure, publicProcedure } from "../../trpc";
import * as inputs from "./link.input";
import * as services from "./link.service";

import type { PublicTRPCContext } from "../../trpc";
export const linkRouter = createTRPCRouter({
  retrieveOriginalUrl: publicProcedure
    .input(inputs.retrieveOriginalUrlSchema)
    .query(({ ctx, input }: { ctx: PublicTRPCContext; input: inputs.RetrieveOriginalUrlInput }) => {
      return services.retrieveOriginalUrl(ctx, input);
    }),

  list: protectedProcedure.query(({ ctx }) => {
    return services.getLinks(ctx);
  }),

  get: protectedProcedure
    .input(
      z.object({
        id: z.number(),
      }),
    )
    .query(({ ctx, input }) => {
      // todo: implement
      return undefined;
    }),

  create: protectedProcedure.input(inputs.createLinkSchema).mutation(({ ctx, input }) => {
    return services.createLink(ctx, input);
  }),

  update: protectedProcedure.input(inputs.updateLinkSchema).mutation(({ ctx, input }) => {
    return services.updateLink(ctx, input);
  }),

  delete: protectedProcedure
    .input(
      z.object({
        id: z.number(),
      }),
    )
    .mutation(({ ctx, input }) => {
      return services.deleteLink(ctx, input);
    }),
});
