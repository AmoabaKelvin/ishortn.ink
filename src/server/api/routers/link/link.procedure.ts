import { z } from "zod";

import {
    createTRPCRouter,
    protectedProcedure,
    publicProcedure,
    workspaceProcedure,
} from "../../trpc";

import * as inputs from "./link.input";
import * as services from "./link.service";
import * as transferServices from "./transfer.service";

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

  list: workspaceProcedure
    .input(inputs.listLinksSchema)
    .output(inputs.listLinksOutputSchema)
    .query(({ ctx, input }) => {
      return services.getLinks(ctx, input);
    }),

  get: workspaceProcedure
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

  create: workspaceProcedure
    .input(inputs.createLinkSchema)
    .mutation(({ ctx, input }) => {
      return services.createLink(ctx, input);
    }),

  update: workspaceProcedure
    .input(inputs.updateLinkSchema)
    .mutation(({ ctx, input }) => {
      return services.updateLink(ctx, input);
    }),

  delete: workspaceProcedure
    .input(inputs.getLinkSchema)
    .mutation(({ ctx, input }) => {
      return services.deleteLink(ctx, input);
    }),

  quickShorten: workspaceProcedure
    .input(inputs.quickLinkShorteningSchema)
    .mutation(({ ctx, input }) => {
      return services.shortenLinkWithAutoAlias(ctx, input);
    }),

  linkVisits: workspaceProcedure
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

  allAnalytics: workspaceProcedure
    .input(inputs.allAnalyticsSchema)
    .query(({ ctx, input }) => {
      return services.getAllUserAnalytics(ctx, input);
    }),

  toggleLinkStatus: workspaceProcedure
    .input(inputs.getLinkSchema)
    .mutation(({ ctx, input }) => {
      return services.toggleLinkStatus(ctx, input);
    }),

  togglePublicStats: workspaceProcedure
    .input(inputs.getLinkSchema)
    .mutation(({ ctx, input }) => {
      return services.togglePublicStats(ctx, input);
    }),

  toggleArchive: workspaceProcedure
    .input(inputs.ToggleArchiveInput)
    .mutation(({ ctx, input }) => {
      return services.toggleArchive(ctx, input);
    }),

  resetLinkStatistics: workspaceProcedure
    .input(inputs.getLinkSchema)
    .mutation(({ ctx, input }) => {
      return services.resetLinkStatistics(ctx, input);
    }),

  verifyLinkPassword: protectedProcedure
    .input(inputs.verifyLinkPasswordSchema)
    .mutation(({ ctx, input }) => {
      return services.verifyLinkPassword(ctx, input);
    }),

  changeLinkPassword: workspaceProcedure
    .input(inputs.verifyLinkPasswordSchema)
    .mutation(({ ctx, input }) => {
      return services.changeLinkPassword(ctx, input);
    }),

  checkAliasAvailability: publicProcedure
    .input(z.object({ alias: z.string(), domain: z.string() }))
    .query(async ({ ctx, input }) => {
      return services.checkAliasAvailability(ctx, input);
    }),

  bulkUpload: workspaceProcedure
    .input(z.object({ csv: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return services.bulkCreateLinks(ctx, input.csv);
    }),

  exportUserLinks: workspaceProcedure.mutation(async ({ ctx }) => {
    return services.exportAllUserLinks(ctx);
  }),

  checkVercelHeaders: publicProcedure.query(async ({ ctx }) => {
    return services.checkPresenceOfVercelHeaders(ctx);
  }),

  stats: workspaceProcedure.query(async ({ ctx }) => {
    return services.getStats(ctx);
  }),

  // ============================================================================
  // TRANSFER LINKS PROCEDURES
  // ============================================================================

  /** Get all workspaces the user can transfer links to */
  getAvailableWorkspaces: workspaceProcedure.query(async ({ ctx }) => {
    return transferServices.getAvailableWorkspaces(ctx);
  }),

  /** Validate a transfer before executing it (dry run) */
  validateTransfer: workspaceProcedure
    .input(inputs.validateTransferSchema)
    .mutation(async ({ ctx, input }) => {
      return transferServices.validateTransfer(ctx, input);
    }),

  /** Transfer links to another workspace */
  transferToWorkspace: workspaceProcedure
    .input(inputs.transferLinksToWorkspaceSchema)
    .mutation(async ({ ctx, input }) => {
      return transferServices.transferLinksToWorkspace(ctx, input);
    }),

  /** Bulk delete links */
  bulkDelete: workspaceProcedure
    .input(inputs.bulkDeleteLinksSchema)
    .mutation(async ({ ctx, input }) => {
      return services.bulkDeleteLinks(ctx, input.linkIds);
    }),

  /** Bulk archive/restore links */
  bulkArchive: workspaceProcedure
    .input(inputs.bulkArchiveLinksSchema)
    .mutation(async ({ ctx, input }) => {
      return services.bulkArchiveLinks(ctx, input);
    }),

  /** Bulk activate/deactivate links */
  bulkToggleStatus: workspaceProcedure
    .input(inputs.bulkToggleLinkStatusSchema)
    .mutation(async ({ ctx, input }) => {
      return services.bulkToggleLinkStatus(ctx, input);
    }),
});
