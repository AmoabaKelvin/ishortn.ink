import { z } from "zod";

import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
} from "../../trpc";

import * as inputs from "./link.input";
import * as services from "./link.service";

import type { PublicTRPCContext } from "../../trpc";

export const linkRouter = createTRPCRouter({
  retrieveOriginalUrl: publicProcedure
    .input(inputs.retrieveOriginalUrlSchema)
    .query(
      ({
        ctx,
        input,
      }: {
        ctx: PublicTRPCContext;
        input: inputs.RetrieveOriginalUrlInput;
      }) => {
        return services.retrieveOriginalUrl(ctx, input);
      }
    ),

  list: protectedProcedure
    .input(inputs.listLinksSchema)
    .query(({ ctx, input }) => {
      return services.getLinks(ctx, input);
    }),

  get: protectedProcedure
    .input(inputs.getLinkSchema)
    .query(({ ctx, input }) => {
      return services.getLink(ctx, input);
    }),

  getLinkByAlias: publicProcedure
    .input(
      z.object({
        alias: z.string(),
        domain: z.string(),
      })
    )
    .query(({ input }) => {
      return services.getLinkByAlias(input);
    }),

  create: protectedProcedure
    .input(inputs.createLinkSchema)
    .mutation(({ ctx, input }) => {
      return services.createLink(ctx, input);
    }),

  update: protectedProcedure
    .input(inputs.updateLinkSchema)
    .mutation(({ ctx, input }) => {
      return services.updateLink(ctx, input);
    }),

  delete: protectedProcedure
    .input(inputs.getLinkSchema)
    .mutation(({ ctx, input }) => {
      return services.deleteLink(ctx, input);
    }),

  quickShorten: protectedProcedure
    .input(inputs.quickLinkShorteningSchema)
    .mutation(({ ctx, input }) => {
      return services.shortenLinkWithAutoAlias(ctx, input);
    }),

  linkVisits: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        domain: z.string(),
        range: z
          .enum([
            "24h",
            "7d",
            "30d",
            "90d",
            "this_month",
            "last_month",
            "this_year",
            "last_year",
            "all",
          ])
          .default("7d"),
      })
    )
    .query(({ ctx, input }) => {
      return services.getLinkVisits(ctx, input);
    }),

  toggleLinkStatus: protectedProcedure
    .input(inputs.getLinkSchema)
    .mutation(({ ctx, input }) => {
      return services.toggleLinkStatus(ctx, input);
    }),

  togglePublicStats: protectedProcedure
    .input(inputs.getLinkSchema)
    .mutation(({ ctx, input }) => {
      return services.togglePublicStats(ctx, input);
    }),

  resetLinkStatistics: protectedProcedure
    .input(inputs.getLinkSchema)
    .mutation(({ ctx, input }) => {
      return services.resetLinkStatistics(ctx, input);
    }),

  verifyLinkPassword: protectedProcedure
    .input(inputs.verifyLinkPasswordSchema)
    .mutation(({ ctx, input }) => {
      return services.verifyLinkPassword(ctx, input);
    }),

  changeLinkPassword: protectedProcedure
    .input(inputs.verifyLinkPasswordSchema)
    .mutation(({ ctx, input }) => {
      return services.changeLinkPassword(ctx, input);
    }),

  checkAliasAvailability: publicProcedure
    .input(z.object({ alias: z.string(), domain: z.string() }))
    .query(async ({ ctx, input }) => {
      return services.checkAliasAvailability(ctx, input);
    }),

  bulkUpload: protectedProcedure
    .input(z.object({ csv: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return services.bulkCreateLinks(ctx, input.csv);
    }),

  exportUserLinks: protectedProcedure.mutation(async ({ ctx }) => {
    return services.exportAllUserLinks(ctx);
  }),

  checkVercelHeaders: publicProcedure.query(async ({ ctx }) => {
    return services.checkPresenceOfVercelHeaders(ctx);
  }),
});
