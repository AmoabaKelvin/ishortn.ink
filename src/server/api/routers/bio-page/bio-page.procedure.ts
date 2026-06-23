import { createTRPCRouter, publicProcedure, workspaceProcedure } from "../../trpc";

import * as inputs from "./bio-page.input";
import * as services from "./bio-page.service";

export const bioPageRouter = createTRPCRouter({
  list: workspaceProcedure.query(({ ctx }) => services.listBioPages(ctx)),

  get: workspaceProcedure
    .input(inputs.bioPageIdSchema)
    .query(({ ctx, input }) => services.getBioPage(ctx, input.id)),

  create: workspaceProcedure
    .input(inputs.createBioPageSchema)
    .mutation(({ ctx, input }) => services.createBioPage(ctx, input)),

  update: workspaceProcedure
    .input(inputs.updateBioPageSchema)
    .mutation(({ ctx, input }) => services.updateBioPage(ctx, input)),

  togglePublished: workspaceProcedure
    .input(inputs.togglePublishedSchema)
    .mutation(({ ctx, input }) => services.togglePublished(ctx, input)),

  delete: workspaceProcedure
    .input(inputs.bioPageIdSchema)
    .mutation(({ ctx, input }) => services.deleteBioPage(ctx, input.id)),

  addBlock: workspaceProcedure
    .input(inputs.addBioBlockSchema)
    .mutation(({ ctx, input }) => services.addBlock(ctx, input)),

  updateBlock: workspaceProcedure
    .input(inputs.updateBioBlockSchema)
    .mutation(({ ctx, input }) => services.updateBlock(ctx, input)),

  deleteBlock: workspaceProcedure
    .input(inputs.blockIdSchema)
    .mutation(({ ctx, input }) => services.deleteBlock(ctx, input.id)),

  reorderBlocks: workspaceProcedure
    .input(inputs.reorderBlocksSchema)
    .mutation(({ ctx, input }) => services.reorderBlocks(ctx, input)),

  getAnalytics: workspaceProcedure
    .input(inputs.getBioPageAnalyticsSchema)
    .query(({ ctx, input }) => services.getBioPageAnalytics(ctx, input)),

  // Public — used by the /p/[slug] render route and custom-domain root.
  getBySlug: publicProcedure
    .input(inputs.getPublicBioPageSchema)
    .query(({ ctx, input }) => services.getPublicBioPageBySlug(ctx, input.slug)),

  getByDomain: publicProcedure
    .input(inputs.getPublicBioPageByDomainSchema)
    .query(({ ctx, input }) => services.getPublicBioPageByDomain(ctx, input.domain)),
});
