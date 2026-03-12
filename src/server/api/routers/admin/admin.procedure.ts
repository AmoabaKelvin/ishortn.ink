import { createTRPCRouter, adminProcedure } from "../../trpc";

import * as inputs from "./admin.input";
import * as services from "./admin.service";

export const adminRouter = createTRPCRouter({
  getStats: adminProcedure.query(({ ctx }) => services.getStats(ctx)),

  getRecentActivity: adminProcedure.query(({ ctx }) =>
    services.getRecentActivity(ctx),
  ),

  getDailyStats: adminProcedure.query(({ ctx }) =>
    services.getDailyStats(ctx),
  ),

  getRecentUsers: adminProcedure.query(({ ctx }) =>
    services.getRecentUsers(ctx),
  ),

  searchLinks: adminProcedure
    .input(inputs.searchLinksSchema)
    .query(({ ctx, input }) => services.searchLinks(ctx, input)),

  blockLink: adminProcedure
    .input(inputs.blockLinkSchema)
    .mutation(({ ctx, input }) => services.blockLink(ctx, input)),

  unblockLink: adminProcedure
    .input(inputs.unblockLinkSchema)
    .mutation(({ ctx, input }) => services.unblockLink(ctx, input)),

  searchUsers: adminProcedure
    .input(inputs.searchUsersSchema)
    .query(({ ctx, input }) => services.searchUsers(ctx, input)),

  banUser: adminProcedure
    .input(inputs.banUserSchema)
    .mutation(({ ctx, input }) => services.banUser(ctx, input)),

  unbanUser: adminProcedure
    .input(inputs.unbanUserSchema)
    .mutation(({ ctx, input }) => services.unbanUser(ctx, input)),

  getBlockedDomains: adminProcedure.query(({ ctx }) =>
    services.getBlockedDomains(ctx),
  ),

  addBlockedDomain: adminProcedure
    .input(inputs.addBlockedDomainSchema)
    .mutation(({ ctx, input }) => services.addBlockedDomain(ctx, input)),

  removeBlockedDomain: adminProcedure
    .input(inputs.removeBlockedDomainSchema)
    .mutation(({ ctx, input }) => services.removeBlockedDomain(ctx, input)),

  getFlaggedLinks: adminProcedure
    .input(inputs.getFlaggedLinksSchema)
    .query(({ ctx, input }) => services.getFlaggedLinks(ctx, input)),

  resolveFlaggedLink: adminProcedure
    .input(inputs.resolveFlaggedLinkSchema)
    .mutation(({ ctx, input }) => services.resolveFlaggedLink(ctx, input)),

  // Analytics
  getAnalytics: adminProcedure
    .input(inputs.getAnalyticsSchema)
    .query(({ ctx, input }) => services.getAnalytics(ctx, input)),

  getActivityChart: adminProcedure
    .input(inputs.getActivityChartSchema)
    .query(({ ctx, input }) => services.getActivityChart(ctx, input)),

  getTopUsers: adminProcedure
    .input(inputs.getTopUsersSchema)
    .query(({ ctx, input }) => services.getTopUsers(ctx, input)),

  getTopLinks: adminProcedure
    .input(inputs.getTopLinksSchema)
    .query(({ ctx, input }) => services.getTopLinks(ctx, input)),

  getPeakPeriods: adminProcedure
    .input(inputs.getPeakPeriodsSchema)
    .query(({ ctx, input }) => services.getPeakPeriods(ctx, input)),

  getMonthlyBreakdown: adminProcedure
    .input(inputs.getMonthlyBreakdownSchema)
    .query(({ ctx, input }) => services.getMonthlyBreakdown(ctx, input)),

  getSystemHealth: adminProcedure.query(({ ctx }) =>
    services.getSystemHealth(ctx),
  ),
});
