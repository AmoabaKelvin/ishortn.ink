import { createTRPCRouter, workspaceProcedure } from "@/server/api/trpc";

import {
  getLinkMilestonesSchema,
  resetMilestoneNotificationsSchema,
  upsertMilestonesSchema,
} from "./link-milestone.input";
import {
  getLinkMilestones,
  resetMilestoneNotifications,
  upsertMilestones,
} from "./link-milestone.service";

export const linkMilestoneRouter = createTRPCRouter({
  getByLinkId: workspaceProcedure
    .input(getLinkMilestonesSchema)
    .query(async ({ ctx, input }) => {
      return getLinkMilestones(ctx, input);
    }),

  upsert: workspaceProcedure
    .input(upsertMilestonesSchema)
    .mutation(async ({ ctx, input }) => {
      return upsertMilestones(ctx, input);
    }),

  resetNotifications: workspaceProcedure
    .input(resetMilestoneNotificationsSchema)
    .mutation(async ({ ctx, input }) => {
      return resetMilestoneNotifications(ctx, input);
    }),
});
