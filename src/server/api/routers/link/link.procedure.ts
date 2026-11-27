import { z } from "zod";

import {
  createTRPCRouter,
  publicProcedure,
  contentWriteProcedure,
  workspaceProcedure,
} from "../../trpc";
import * as clickExportServices from "./click-export.service";
import * as inputs from "./link.input";
import * as services from "./link.service";
import * as transferServices from "./transfer.service";

import type { PublicTRPCContext } from "../../trpc";

export const linkRouter = createTRPCRouter({
  retrieveOriginalUrl: publicProcedure
    .input(inputs.retrieveOriginalUrlSchema)
    .query(({ ctx, input }: { ctx: PublicTRPCContext; input: inputs.RetrieveOriginalUrlInput }) => {
      return services.retrieveOriginalUrl(ctx, input);
    }),

  list: workspaceProcedure.input(inputs.listLinksSchema).query(({ ctx, input }) => {
    return services.getLinks(ctx, input);
  }),

  get: workspaceProcedure.input(inputs.getLinkSchema).query(({ ctx, input }) => {
    return services.getLink(ctx, input);
  }),

  create: contentWriteProcedure.input(inputs.createLinkSchema).mutation(({ ctx, input }) => {
    return services.createLink(ctx, input);
  }),

  update: contentWriteProcedure.input(inputs.updateLinkSchema).mutation(({ ctx, input }) => {
    return services.updateLink(ctx, input);
  }),

  delete: workspaceProcedure.input(inputs.getLinkSchema).mutation(({ ctx, input }) => {
    return services.deleteLink(ctx, input);
  }),

  quickShorten: contentWriteProcedure
    .input(inputs.quickLinkShorteningSchema)
    .mutation(({ ctx, input }) => {
      return services.shortenLinkWithAutoAlias(ctx, input);
    }),

  linkVisits: workspaceProcedure.input(inputs.linkVisitsSchema).query(({ ctx, input }) => {
    return services.getLinkVisits(ctx, input);
  }),

  allAnalytics: workspaceProcedure.input(inputs.allAnalyticsSchema).query(({ ctx, input }) => {
    return services.getAllUserAnalytics(ctx, input);
  }),

  // A mutation so the export runs on click, not on every analytics render.
  exportClicks: workspaceProcedure.input(inputs.exportClicksSchema).mutation(({ ctx, input }) => {
    return clickExportServices.exportClicks(ctx, input);
  }),

  toggleLinkStatus: contentWriteProcedure.input(inputs.getLinkSchema).mutation(({ ctx, input }) => {
    return services.toggleLinkStatus(ctx, input);
  }),

  togglePublicStats: workspaceProcedure.input(inputs.getLinkSchema).mutation(({ ctx, input }) => {
    return services.togglePublicStats(ctx, input);
  }),

  toggleArchive: workspaceProcedure.input(inputs.ToggleArchiveInput).mutation(({ ctx, input }) => {
    return services.toggleArchive(ctx, input);
  }),

  resetLinkStatistics: workspaceProcedure.input(inputs.getLinkSchema).mutation(({ ctx, input }) => {
    return services.resetLinkStatistics(ctx, input);
  }),

  // Public: visitors unlocking a link are usually signed out. Rate limited in the service.
  verifyLinkPassword: publicProcedure
    .input(inputs.verifyLinkPasswordSchema)
    .mutation(({ ctx, input }) => {
      return services.verifyLinkPassword(ctx, input);
    }),

  changeLinkPassword: contentWriteProcedure
    .input(inputs.verifyLinkPasswordSchema)
    .mutation(({ ctx, input }) => {
      return services.changeLinkPassword(ctx, input);
    }),

  checkAliasAvailability: publicProcedure
    .input(z.object({ alias: z.string(), domain: z.string() }))
    .query(async ({ ctx, input }) => {
      return services.checkAliasAvailability(ctx, input);
    }),

  bulkUpload: contentWriteProcedure
    .input(inputs.bulkUploadSchema)
    .mutation(async ({ ctx, input }) => {
      return services.bulkCreateLinks(ctx, input.csv, undefined, {
        keepBitlyCodes: input.keepBitlyCodes,
        qrCodes: input.qrCodes,
      });
    }),

  exportUserLinks: workspaceProcedure.mutation(async ({ ctx }) => {
    return services.exportAllUserLinks(ctx);
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
  transferToWorkspace: contentWriteProcedure
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
  bulkToggleStatus: contentWriteProcedure
    .input(inputs.bulkToggleLinkStatusSchema)
    .mutation(async ({ ctx, input }) => {
      return services.bulkToggleLinkStatus(ctx, input);
    }),
});
