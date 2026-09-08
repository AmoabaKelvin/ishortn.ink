import { createTRPCRouter, workspaceProcedure } from "../../trpc";
import * as inputs from "./campaign.input";
import * as services from "./campaign.service";

export const campaignRouter = createTRPCRouter({
  list: workspaceProcedure
    .input(inputs.listCampaignsSchema)
    .query(({ ctx, input }) => services.listCampaigns(ctx, input)),

  listNames: workspaceProcedure.query(({ ctx }) => services.listCampaignNames(ctx)),

  linkCandidates: workspaceProcedure.query(({ ctx }) => services.listLinkCandidates(ctx)),

  get: workspaceProcedure
    .input(inputs.campaignIdSchema)
    .query(({ ctx, input }) => services.getCampaign(ctx, input.id)),

  getBySlug: workspaceProcedure
    .input(inputs.campaignSlugSchema)
    .query(({ ctx, input }) => services.getCampaignBySlug(ctx, input.slug)),

  create: workspaceProcedure
    .input(inputs.createCampaignSchema)
    .mutation(({ ctx, input }) => services.createCampaign(ctx, input)),

  update: workspaceProcedure
    .input(inputs.updateCampaignSchema)
    .mutation(({ ctx, input }) => services.updateCampaign(ctx, input)),

  delete: workspaceProcedure
    .input(inputs.campaignIdSchema)
    .mutation(({ ctx, input }) => services.deleteCampaign(ctx, input.id)),

  addLinks: workspaceProcedure
    .input(inputs.addLinksSchema)
    .mutation(({ ctx, input }) => services.addLinks(ctx, input)),

  removeLink: workspaceProcedure
    .input(inputs.removeLinkSchema)
    .mutation(({ ctx, input }) => services.removeLink(ctx, input)),

  analytics: workspaceProcedure
    .input(inputs.campaignAnalyticsSchema)
    .query(({ ctx, input }) => services.getCampaignAnalytics(ctx, input)),
});
