import {
  createTRPCRouter,
  publicProcedure,
  contentWriteProcedure,
  workspaceProcedure,
} from "../../trpc";
import * as inputs from "./bio-page.input";
import * as services from "./bio-page.service";

export const bioPageRouter = createTRPCRouter({
  list: workspaceProcedure.query(({ ctx }) => services.listBioPages(ctx)),

  get: workspaceProcedure
    .input(inputs.bioPageIdSchema)
    .query(({ ctx, input }) => services.getBioPage(ctx, input.id)),

  create: contentWriteProcedure
    .input(inputs.createBioPageSchema)
    .mutation(({ ctx, input }) => services.createBioPage(ctx, input)),

  update: contentWriteProcedure
    .input(inputs.updateBioPageSchema)
    .mutation(({ ctx, input }) => services.updateBioPage(ctx, input)),

  togglePublished: contentWriteProcedure
    .input(inputs.togglePublishedSchema)
    .mutation(({ ctx, input }) => services.togglePublished(ctx, input)),

  delete: workspaceProcedure
    .input(inputs.bioPageIdSchema)
    .mutation(({ ctx, input }) => services.deleteBioPage(ctx, input.id)),

  addBlock: contentWriteProcedure
    .input(inputs.addBioBlockSchema)
    .mutation(({ ctx, input }) => services.addBlock(ctx, input)),

  updateBlock: contentWriteProcedure
    .input(inputs.updateBioBlockSchema)
    .mutation(({ ctx, input }) => services.updateBlock(ctx, input)),

  deleteBlock: workspaceProcedure
    .input(inputs.blockIdSchema)
    .mutation(({ ctx, input }) => services.deleteBlock(ctx, input.id)),

  reorderBlocks: contentWriteProcedure
    .input(inputs.reorderBlocksSchema)
    .mutation(({ ctx, input }) => services.reorderBlocks(ctx, input)),

  listSubscribers: workspaceProcedure
    .input(inputs.listSubscribersSchema)
    .query(({ ctx, input }) => services.listSubscribers(ctx, input)),

  // Deleting a subscriber is cleanup, so restricted accounts can still do it.
  deleteSubscriber: workspaceProcedure
    .input(inputs.subscriberIdSchema)
    .mutation(({ ctx, input }) => services.deleteSubscriber(ctx, input.id)),

  // A mutation, like link.exportClicks: it's a one-off download, not cached data.
  exportSubscribers: workspaceProcedure
    .input(inputs.bioPageIdSchema)
    .mutation(({ ctx, input }) => services.exportSubscribers(ctx, input.id)),

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
